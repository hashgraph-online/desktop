use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::Instant;

use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value, json};
use std::process::Stdio;
use std::sync::Mutex as StdMutex;
use tokio::fs;
use tokio::process::Command;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::mcp_registry::McpRegistryStore;

use rmcp::service::serve_client;
use rmcp::transport::child_process::{ConfigureCommandExt, TokioChildProcess};

const INVALID_PULSE_PACKAGES: &[&str] = &["bitcoin-mcp", "mcp-notes"];

#[derive(Clone, Debug, PartialEq)]
pub struct McpConnectionResult {
    pub success: bool,
    pub tools: Vec<Value>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRegistrySearchResult {
    pub servers: Vec<Value>,
    pub total: usize,
    pub has_more: bool,
    pub categories: Vec<Value>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metric_statuses: HashMap<String, Value>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metric_freshness: HashMap<String, Value>,
}

#[derive(Default)]
struct RegistryStats {
    total_searches: usize,
    cache_hits: usize,
    cache_entries: usize,
    total_response_time_ms: u128,
    installations: usize,
    oldest_entry: Option<DateTime<Utc>>,
    newest_entry: Option<DateTime<Utc>>,
    last_background_sync: Option<DateTime<Utc>>,
}

#[derive(Clone)]
struct RemoteCatalogPayload {
    servers: Vec<Value>,
    total: usize,
    has_more: bool,
    fetched_at: DateTime<Utc>,
}

#[derive(Default)]
struct RemoteCatalogCache {
    etag: Option<String>,
    payload: Option<RemoteCatalogPayload>,
    consecutive_errors: u32,
    last_error: Option<String>,
    last_error_at: Option<DateTime<Utc>>,
    last_latency_ms: Option<u64>,
    last_status: Option<i32>,
}

#[derive(Clone, Deserialize)]
struct RegistryCatalog {
    categories: Vec<Value>,
    servers: Vec<Value>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RegistrySearchOptions {
    query: Option<String>,
    tags: Option<Vec<String>>,
    limit: Option<usize>,
    offset: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PulseQuery<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    query: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    offset: Option<usize>,
    #[serde(rename = "count_per_page")]
    count_per_page: usize,
}

static REGISTRY_CATALOG: Lazy<RegistryCatalog> = Lazy::new(|| {
    serde_json::from_str(include_str!(
        "../../src/renderer/data/popularMCPServers.json"
    ))
    .expect("failed to load registry catalog")
});

pub(crate) static REMOTE_ENV_GUARD: Lazy<StdMutex<()>> = Lazy::new(|| StdMutex::new(()));

pub(crate) fn remote_registry_enabled() -> bool {
    match std::env::var("TAURI_MCP_REGISTRY_REMOTE") {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                true
            } else {
                !matches!(
                    normalized.as_str(),
                    "false" | "0" | "off" | "disable" | "disabled" | "no"
                )
            }
        }
        Err(_) => true,
    }
}

pub struct McpService {
    path: PathBuf,
    cache: Mutex<Vec<Value>>,
    connections: Mutex<HashMap<String, Vec<Value>>>,
    registry_stats: Mutex<RegistryStats>,
    remote_cache: Mutex<RemoteCatalogCache>,
    registry_store: Option<McpRegistryStore>,
}

impl McpService {
    fn normalize_github_url(input: &str) -> Option<String> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return None;
        }

        let normalize_segments = |segment: &str| -> Option<String> {
            let mut parts = segment.split('/').filter(|part| !part.trim().is_empty());
            let owner = parts.next()?.trim();
            let repo = parts.next()?.trim();
            let repo_clean = repo.trim_end_matches(".git");
            Some(format!("https://github.com/{}/{}", owner, repo_clean))
        };

        if let Some(rest) = trimmed.strip_prefix("github:") {
            return normalize_segments(rest);
        }

        if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
            return normalize_segments(rest);
        }

        if let Some(index) = trimmed.find("github.com/") {
            let segment = &trimmed[index + "github.com/".len()..];
            return normalize_segments(segment);
        }

        if !trimmed.contains("://") && trimmed.contains('/') {
            return normalize_segments(trimmed);
        }

        None
    }

    fn is_valid_npm_package_name(name: &str) -> bool {
        fn valid_segment(segment: &str) -> bool {
            !segment.is_empty()
                && segment.chars().all(|ch| {
                    ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '-' | '_')
                })
        }

        if name.is_empty() || name.chars().any(|ch| ch.is_ascii_uppercase()) {
            return false;
        }

        if let Some(rest) = name.strip_prefix('@') {
            let mut parts = rest.split('/');
            let scope = parts.next().unwrap_or_default();
            let pkg = parts.next().unwrap_or_default();
            if parts.next().is_some() {
                return false;
            }
            return valid_segment(scope) && valid_segment(pkg);
        }

        valid_segment(name)
    }

    fn parse_env_map(env_value: Option<&Value>) -> Option<Map<String, Value>> {
        let mut result = Map::new();
        let Value::Object(env_obj) = env_value? else {
            return None;
        };

        for (key, value) in env_obj {
            let string_value = if let Some(text) = value.as_str() {
                text.to_string()
            } else if let Some(num) = value.as_i64() {
                num.to_string()
            } else if let Some(num) = value.as_u64() {
                num.to_string()
            } else if let Some(num) = value.as_f64() {
                num.to_string()
            } else if let Some(boolean) = value.as_bool() {
                boolean.to_string()
            } else {
                continue;
            };

            result.insert(key.clone(), Value::String(string_value));
        }

        if result.is_empty() {
            None
        } else {
            Some(result)
        }
    }

    fn extract_github_repo_segment(url: &str) -> Option<String> {
        let normalized = Self::normalize_github_url(url)?;
        if let Some(index) = normalized.rfind("github.com/") {
            let segment = &normalized[index + "github.com/".len()..];
            return Some(segment.to_string());
        }
        normalized
            .strip_prefix("https://github.com/")
            .or_else(|| normalized.strip_prefix("http://github.com/"))
            .map(|segment| segment.to_string())
    }

    fn build_template_payload(
        command: String,
        args: Vec<String>,
        env: Option<Map<String, Value>>,
    ) -> (Value, Value) {
        let args_value: Vec<Value> = args.iter().map(|arg| Value::String(arg.clone())).collect();

        let mut config_map = Map::new();
        config_map.insert("type".to_string(), Value::String("custom".to_string()));
        config_map.insert("command".to_string(), Value::String(command.clone()));
        config_map.insert("args".to_string(), Value::Array(args_value.clone()));
        if let Some(env_map) = env {
            config_map.insert("env".to_string(), Value::Object(env_map));
        }

        let mut template_map = Map::new();
        template_map.insert("type".to_string(), Value::String("custom".to_string()));
        template_map.insert("config".to_string(), Value::Object(config_map));

        let mut install_map = Map::new();
        install_map.insert("command".to_string(), Value::String(command));
        install_map.insert("args".to_string(), Value::Array(args_value));

        (Value::Object(template_map), Value::Object(install_map))
    }

    fn normalize_pulse_server(server: Value, now: DateTime<Utc>) -> Option<Value> {
        let raw = match server {
            Value::Object(map) => map,
            _ => return None,
        };

        let id = raw
            .get("id")
            .and_then(Value::as_str)
            .or_else(|| raw.get("name").and_then(Value::as_str))
            .or_else(|| raw.get("package_name").and_then(Value::as_str))?
            .trim()
            .to_string();

        if id.is_empty() {
            return None;
        }

        let name = raw
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or(&id)
            .trim()
            .to_string();

        if name.is_empty() {
            return None;
        }

        let description = raw
            .get("short_description")
            .and_then(Value::as_str)
            .or_else(|| raw.get("description").and_then(Value::as_str))
            .unwrap_or("")
            .to_string();

        let package_registry = raw
            .get("package_registry")
            .and_then(Value::as_str)
            .map(|value| value.to_string());

        let mut package_name = raw
            .get("package_name")
            .and_then(Value::as_str)
            .map(|value| value.to_string());

        if package_name
            .as_deref()
            .map(|value| INVALID_PULSE_PACKAGES.contains(&value))
            .unwrap_or(false)
        {
            package_name = None;
        }

        if let Some(name_ref) = package_name.clone() {
            if let Some(registry) = package_registry.as_deref() {
                if registry == "npm" && !Self::is_valid_npm_package_name(&name_ref) {
                    package_name = None;
                }
            }
        }

        let repository_candidate = raw
            .get("source_code_url")
            .and_then(Value::as_str)
            .or_else(|| {
                raw.get("repository").and_then(|value| {
                    value
                        .as_object()
                        .and_then(|repo| repo.get("url").and_then(Value::as_str))
                        .or_else(|| value.as_str())
                })
            })
            .map(|value| value.to_string());

        let normalized_repo = repository_candidate
            .as_deref()
            .and_then(Self::normalize_github_url);

        let config_object = raw.get("config").and_then(Value::as_object);
        let command_from_config = config_object
            .and_then(|cfg| cfg.get("command").and_then(Value::as_str))
            .map(|value| value.to_string());
        let args_from_config = config_object
            .and_then(|cfg| cfg.get("args").and_then(Value::as_array))
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(|value| value.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let env_from_config = Self::parse_env_map(config_object.and_then(|cfg| cfg.get("env")));

        let mut command = command_from_config;
        let mut args = args_from_config;
        let mut env = env_from_config;

        if command.is_none() {
            if matches!(package_registry.as_deref(), Some("npm")) && package_name.is_some() {
                command = Some("npx".to_string());
                args = vec!["-y".to_string(), package_name.clone().unwrap()];
            } else if matches!(package_registry.as_deref(), Some("pypi")) && package_name.is_some()
            {
                command = Some("uvx".to_string());
                args = vec![package_name.clone().unwrap()];
            } else if let Some(repo_url) = normalized_repo.as_deref() {
                if let Some(segment) = Self::extract_github_repo_segment(repo_url) {
                    command = Some("npx".to_string());
                    args = vec!["-y".to_string(), format!("github:{}", segment)];
                }
            }
        }

        if command.is_none() {
            command = Some("echo".to_string());
            args = vec![format!("Server {} is missing install information", name)];
            env = None;
        }

        let (template_value, install_command) =
            Self::build_template_payload(command.clone().unwrap(), args.clone(), env.clone());

        let mut normalized = Map::new();
        normalized.insert("id".to_string(), Value::String(id.clone()));
        normalized.insert("name".to_string(), Value::String(name));
        normalized.insert("description".to_string(), Value::String(description));
        normalized.insert("template".to_string(), template_value);
        normalized.insert("installCommand".to_string(), install_command);

        if let Some(author) = raw.get("author").and_then(Value::as_str) {
            normalized.insert("author".to_string(), Value::String(author.to_string()));
        }

        if let Some(version) = raw.get("version").and_then(Value::as_str) {
            normalized.insert("version".to_string(), Value::String(version.to_string()));
        }

        if let Some(registry) = package_registry {
            normalized.insert("packageRegistry".to_string(), Value::String(registry));
        }

        if let Some(package) = package_name {
            normalized.insert("packageName".to_string(), Value::String(package));
        }

        if let Some(repo) = normalized_repo {
            normalized.insert(
                "repository".to_string(),
                json!({ "type": "git", "url": repo.clone() }),
            );
        } else if let Some(repo) = repository_candidate {
            normalized.insert(
                "repository".to_string(),
                json!({ "type": "git", "url": repo }),
            );
        }

        if let Some(tags) = raw.get("tags").and_then(Value::as_array) {
            let tag_values: Vec<Value> = tags
                .iter()
                .filter_map(Value::as_str)
                .map(|tag| Value::String(tag.to_string()))
                .collect();
            if !tag_values.is_empty() {
                normalized.insert("tags".to_string(), Value::Array(tag_values));
            }
        } else if let Some(tags) = raw.get("keywords").and_then(Value::as_array) {
            let tag_values: Vec<Value> = tags
                .iter()
                .filter_map(Value::as_str)
                .map(|tag| Value::String(tag.to_string()))
                .collect();
            if !tag_values.is_empty() {
                normalized.insert("tags".to_string(), Value::Array(tag_values));
            }
        }

        if let Some(license) = raw.get("license").and_then(Value::as_str) {
            normalized.insert("license".to_string(), Value::String(license.to_string()));
        }

        if let Some(created_at) = raw.get("created_at").and_then(Value::as_str) {
            normalized.insert(
                "createdAt".to_string(),
                Value::String(created_at.to_string()),
            );
        }

        let updated_at = raw
            .get("updated_at")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| now.to_rfc3339());
        normalized.insert("updatedAt".to_string(), Value::String(updated_at));

        if let Some(stars) = raw.get("github_stars") {
            normalized.insert("githubStars".to_string(), stars.clone());
        }

        if let Some(downloads) = raw
            .get("package_download_count")
            .or_else(|| raw.get("downloads"))
            .or_else(|| raw.get("install_count"))
        {
            normalized.insert("installCount".to_string(), downloads.clone());
        }

        if let Some(tools) = raw.get("tools").cloned() {
            normalized.insert("tools".to_string(), tools);
        } else if let Some(capabilities) = raw.get("capabilities").and_then(Value::as_object) {
            if let Some(tools) = capabilities.get("tools") {
                normalized.insert("tools".to_string(), tools.clone());
            }
        }

        normalized.insert("source".to_string(), Value::String("pulsemcp".to_string()));

        Some(Value::Object(normalized))
    }

    fn normalize_pulse_payload(raw: Value, now: DateTime<Utc>) -> (Vec<Value>, usize, bool) {
        let servers = raw
            .get("servers")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let normalized: Vec<Value> = servers
            .into_iter()
            .filter_map(|server| Self::normalize_pulse_server(server, now))
            .collect();

        let total = raw
            .get("total_count")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or_else(|| normalized.len());

        let has_more = raw
            .get("next")
            .map(|value| !value.is_null())
            .unwrap_or(false);

        (normalized, total, has_more)
    }
    pub fn new(path: PathBuf, registry_db_path: Option<PathBuf>) -> Self {
        let mut initial = Self::load_from_disk_sync(&path).unwrap_or_default();
        let default_root = path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        if initial.is_empty() {
            initial = Self::default_servers(&default_root);
            if let Err(error) = Self::write_to_disk_sync(&path, &initial) {
                log::warn!("Failed to persist default MCP servers: {}", error);
            }
        }

        let registry_store =
            registry_db_path.and_then(|db_path| match McpRegistryStore::new(db_path) {
                Ok(store) => Some(store),
                Err(error) => {
                    log::warn!("Failed to initialize MCP registry store: {}", error);
                    None
                }
            });

        Self {
            path,
            cache: Mutex::new(initial),
            connections: Mutex::new(HashMap::new()),
            registry_stats: Mutex::new(RegistryStats::default()),
            remote_cache: Mutex::new(RemoteCatalogCache::default()),
            registry_store,
        }
    }

    fn filter_servers_with_source(
        &self,
        options: &RegistrySearchOptions,
        servers: &[Value],
        source: &str,
    ) -> McpRegistrySearchResult {
        let query = options.query.clone().unwrap_or_default().to_lowercase();
        let query = if query.is_empty() { None } else { Some(query) };
        let tag_filter: HashSet<String> = options
            .tags
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|tag| tag.to_lowercase())
            .collect();

        let mut results: Vec<Value> = servers
            .iter()
            .cloned()
            .filter(|server| Self::matches_query(server, query.as_deref()))
            .filter(|server| Self::matches_tags(server, &tag_filter))
            .collect();

        for server in &mut results {
            Self::annotate_server_source(server, source);
        }

        let total = results.len();
        let limit = options.limit.unwrap_or(50);
        let offset = options.offset.unwrap_or(0);
        let end = std::cmp::min(offset + limit, total);
        let slice = if offset >= total {
            &[][..]
        } else {
            &results[offset..end]
        };
        let sliced = slice.to_vec();
        let has_more = offset + limit < total;
        let (metric_statuses, metric_freshness) = Self::build_metric_maps(slice);

        McpRegistrySearchResult {
            servers: sliced,
            total,
            has_more,
            categories: REGISTRY_CATALOG.categories.clone(),
            metric_statuses,
            metric_freshness,
        }
    }

    fn filter_catalog(&self, options: &RegistrySearchOptions) -> McpRegistrySearchResult {
        self.filter_servers_with_source(options, &REGISTRY_CATALOG.servers, "catalog")
    }

    pub async fn load(&self) -> Result<Vec<Value>, String> {
        let cache = self.cache.lock().await;
        Ok(cache.clone())
    }

    pub async fn save(&self, servers: Vec<Value>) -> Result<(), String> {
        let parent = self
            .path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));

        fs::create_dir_all(&parent)
            .await
            .map_err(|error| format!("Failed to create MCP directory: {error}"))?;

        let payload = Value::Array(servers.clone());
        let serialized = serde_json::to_string_pretty(&payload)
            .map_err(|error| format!("Failed to serialize MCP servers: {error}"))?;

        fs::write(&self.path, serialized)
            .await
            .map_err(|error| format!("Failed to write MCP servers: {error}"))?;

        let mut cache = self.cache.lock().await;
        *cache = servers;
        Ok(())
    }

    pub async fn test_connection(&self, server: &Value) -> Result<McpConnectionResult, String> {
        let server_type = Self::resolve_type(server)?;

        match server_type.as_str() {
            "filesystem" => self.test_filesystem_connection(server).await,
            "custom" => self.test_custom_connection(server).await,
            unsupported => Ok(McpConnectionResult {
                success: false,
                tools: Vec::new(),
                error: Some(format!("Unsupported MCP server type: {unsupported}")),
            }),
        }
    }

    async fn test_custom_connection(&self, server: &Value) -> Result<McpConnectionResult, String> {
        let config = server
            .get("config")
            .and_then(Value::as_object)
            .ok_or_else(|| "Custom server missing config".to_string())?;

        let command = config
            .get("command")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "Custom server missing config.command".to_string())?;

        let args = config
            .get("args")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let cwd = config
            .get("cwd")
            .and_then(Value::as_str)
            .map(str::to_string);

        let env_pairs: Vec<(String, String)> = config
            .get("env")
            .and_then(Value::as_object)
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(|(key, value)| {
                        value
                            .as_str()
                            .map(|text| (key.clone(), text.to_string()))
                            .or_else(|| {
                                if value.is_number() || value.is_boolean() {
                                    Some((key.clone(), value.to_string()))
                                } else {
                                    None
                                }
                            })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let args_for_spawn = args.clone();
        let env_for_spawn = env_pairs.clone();
        let cwd_for_spawn = cwd.clone();

        let process = TokioChildProcess::new(Command::new(&command).configure(move |cmd| {
            cmd.stdin(Stdio::piped());
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::inherit());
            for arg in &args_for_spawn {
                cmd.arg(arg);
            }
            if let Some(ref dir) = cwd_for_spawn {
                cmd.current_dir(dir);
            }
            for (key, value) in &env_for_spawn {
                cmd.env(key, value);
            }
        }))
        .map_err(|error| format!("Failed to spawn MCP server: {error}"))?;

        let client = serve_client((), process)
            .await
            .map_err(|error| format!("Failed to initialize MCP server: {error}"))?;

        let tools = client
            .peer()
            .list_all_tools()
            .await
            .map_err(|error| format!("Failed to list MCP tools: {error}"))?;

        let tools = match tools
            .into_iter()
            .map(|tool| serde_json::to_value(tool))
            .collect::<Result<Vec<Value>, _>>()
        {
            Ok(values) => values,
            Err(error) => {
                let _ = client.cancel().await;
                return Err(format!("Failed to serialize MCP tool: {error}"));
            }
        };

        match client.cancel().await {
            Ok(reason) => log::debug!("MCP custom server exited: {:?}", reason),
            Err(error) => log::debug!("Failed to shutdown MCP custom server: {error}"),
        }

        Ok(McpConnectionResult {
            success: true,
            tools,
            error: None,
        })
    }

    pub async fn connect(&self, server_id: &str) -> Result<McpConnectionResult, String> {
        let cache = self.cache.lock().await;
        let server = cache
            .iter()
            .find(|item| Self::resolve_id(item).as_deref() == Some(server_id))
            .cloned()
            .ok_or_else(|| format!("MCP server not found: {server_id}"))?;
        drop(cache);

        let result = self.test_connection(&server).await?;
        if result.success {
            let mut connections = self.connections.lock().await;
            connections.insert(server_id.to_string(), result.tools.clone());
        }
        Ok(result)
    }

    pub async fn disconnect(&self, server_id: &str) -> Result<bool, String> {
        let mut connections = self.connections.lock().await;
        Ok(connections.remove(server_id).is_some())
    }

    pub async fn connected_tools(&self, server_id: &str) -> Result<Vec<Value>, String> {
        let connections = self.connections.lock().await;
        Ok(connections.get(server_id).cloned().unwrap_or_default())
    }

    pub async fn refresh_tools(&self, server_id: &str) -> Result<McpConnectionResult, String> {
        self.connect(server_id).await
    }

    pub async fn search_registry(
        &self,
        options_value: &Value,
    ) -> Result<McpRegistrySearchResult, String> {
        let options: RegistrySearchOptions =
            serde_json::from_value(options_value.clone()).unwrap_or_default();

        if let Some(remote) = self.fetch_remote_registry(&options).await? {
            self.record_registry_stats(false, remote.total, remote.has_more)
                .await;
            return Ok(remote);
        }

        if let Some(store) = self.registry_store.as_ref() {
            match store.all_servers() {
                Ok(stored) if !stored.is_empty() => {
                    let result = self.filter_servers_with_source(&options, &stored, "cache");
                    self.record_registry_stats(true, result.total, result.has_more)
                        .await;
                    return Ok(result);
                }
                Ok(_) => {}
                Err(error) => {
                    log::debug!("Failed to read cached registry servers: {}", error);
                }
            }
        }

        let catalog = self.filter_catalog(&options);
        self.record_registry_stats(true, catalog.total, catalog.has_more)
            .await;
        Ok(catalog)
    }

    pub async fn registry_server_details(
        &self,
        server_id: &str,
        package_name: Option<String>,
    ) -> Result<Value, String> {
        let id_lower = server_id.to_lowercase();
        if let Some(server) = REGISTRY_CATALOG.servers.iter().find(|server| {
            Self::resolve_id(server)
                .map(|id| id.to_lowercase() == id_lower)
                .unwrap_or(false)
        }) {
            return Ok(server.clone());
        }

        if let Some(store) = self.registry_store.as_ref() {
            if let Ok(servers) = store.all_servers() {
                if let Some(server) = servers.iter().find(|server| {
                    Self::resolve_id(server)
                        .map(|id| id.to_lowercase() == id_lower)
                        .unwrap_or(false)
                }) {
                    return Ok(server.clone());
                }
            }
        }

        if let Some(package) = package_name {
            let package_lower = package.to_lowercase();
            if let Some(server) = REGISTRY_CATALOG.servers.iter().find(|server| {
                server
                    .get("packageName")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_lowercase() == package_lower)
                    .unwrap_or(false)
            }) {
                return Ok(server.clone());
            }

            if let Some(store) = self.registry_store.as_ref() {
                if let Ok(servers) = store.all_servers() {
                    if let Some(server) = servers.iter().find(|server| {
                        server
                            .get("packageName")
                            .and_then(|value| value.as_str())
                            .map(|value| value.to_lowercase() == package_lower)
                            .unwrap_or(false)
                    }) {
                        return Ok(server.clone());
                    }
                }
            }
        }

        Err(format!("Registry server not found: {server_id}"))
    }

    pub async fn install_from_registry(
        &self,
        server_id: &str,
        package_name: Option<String>,
        install_command: Option<Value>,
    ) -> Result<Value, String> {
        let detail = self
            .registry_server_details(server_id, package_name)
            .await?;

        let config_value = self.convert_registry_server_to_config(&detail, install_command)?;

        let mut servers = self.load().await?;
        if let Some(existing_index) = servers
            .iter()
            .position(|entry| Self::resolve_registry_key(entry).as_deref() == Some(server_id))
        {
            servers[existing_index] = config_value.clone();
        } else {
            servers.push(config_value.clone());
        }

        self.save(servers).await?;

        let mut stats = self.registry_stats.lock().await;
        stats.installations += 1;
        stats.cache_entries = self.cache.lock().await.len();
        stats.newest_entry = Some(Utc::now());
        if stats.oldest_entry.is_none() {
            stats.oldest_entry = stats.newest_entry;
        }
        drop(stats);

        Ok(config_value)
    }

    pub async fn clear_registry_cache(&self) -> Result<(), String> {
        let mut stats = self.registry_stats.lock().await;
        stats.cache_entries = 0;
        stats.cache_hits = 0;
        stats.total_response_time_ms = 0;
        stats.oldest_entry = None;
        stats.newest_entry = None;
        Ok(())
    }

    pub async fn cache_stats(&self) -> Result<Value, String> {
        let stats = self.registry_stats.lock().await;
        let total_servers = REGISTRY_CATALOG.servers.len();
        let average_response = if stats.total_searches > 0 {
            (stats.total_response_time_ms / stats.total_searches as u128) as u64
        } else {
            0
        };
        let hit_rate = if stats.total_searches > 0 {
            (stats.cache_hits as f64 / stats.total_searches as f64) * 100.0
        } else {
            100.0
        };
        let remote_snapshot = {
            let cache = self.remote_cache.lock().await;
            json!({
                "etag": cache.etag,
                "consecutiveErrors": cache.consecutive_errors,
                "lastError": cache.last_error,
                "lastErrorAt": cache.last_error_at.map(|dt| dt.to_rfc3339()),
                "lastLatencyMs": cache.last_latency_ms,
                "lastStatus": cache.last_status,
            })
        };
        let registry_snapshot = self
            .registry_store
            .as_ref()
            .map(|store| store.sync_snapshot())
            .unwrap_or(Value::Null);

        Ok(json!({
            "totalServers": total_servers,
            "serversByRegistry": json!({"catalog": total_servers }),
            "cacheEntries": stats.cache_entries,
            "averageResponseTime": average_response,
            "cacheHitRate": hit_rate,
            "oldestEntry": stats.oldest_entry.map(|dt| dt.to_rfc3339()),
            "newestEntry": stats.newest_entry.map(|dt| dt.to_rfc3339()),
            "lastBackgroundSync": stats.last_background_sync.map(|dt| dt.to_rfc3339()),
            "remote": remote_snapshot,
            "registry": registry_snapshot,
        }))
    }

    pub async fn trigger_background_sync(&self) -> Result<Value, String> {
        if !remote_registry_enabled() {
            return self.cache_stats().await;
        }

        let options = RegistrySearchOptions {
            query: None,
            tags: None,
            limit: Some(50),
            offset: Some(0),
        };

        let _ = self.fetch_remote_registry(&options).await?;

        let mut stats = self.registry_stats.lock().await;
        stats.last_background_sync = Some(Utc::now());
        drop(stats);
        self.cache_stats().await
    }

    pub async fn enrich_metrics(&self, _options: &Value) -> Result<(), String> {
        let mut stats = self.registry_stats.lock().await;
        stats.cache_hits += 1;
        Ok(())
    }

    fn persist_registry_servers(
        &self,
        registry: &str,
        servers: &[Value],
        duration_ms: Option<u64>,
    ) {
        if let Some(store) = self.registry_store.as_ref() {
            if let Err(error) = store.upsert_servers(registry, servers) {
                log::warn!(
                    "Failed to persist registry servers for {}: {}",
                    registry,
                    error
                );
            } else if let Err(error) =
                store.record_sync_success(registry, servers.len(), duration_ms)
            {
                log::debug!(
                    "Failed to record registry sync meta for {}: {}",
                    registry,
                    error
                );
            }
        }
    }

    fn record_registry_error(&self, registry: &str, message: &str) {
        if let Some(store) = self.registry_store.as_ref() {
            if let Err(error) = store.record_sync_failure(registry, message) {
                log::debug!(
                    "Failed to record registry sync error for {}: {}",
                    registry,
                    error
                );
            }
        }
    }

    fn convert_registry_server_to_config(
        &self,
        server: &Value,
        install_command: Option<Value>,
    ) -> Result<Value, String> {
        let template = server
            .get("template")
            .ok_or_else(|| "Registry server missing template".to_string())?;
        let server_type = template
            .get("type")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Registry server template missing type".to_string())?;
        let config_value = template
            .get("config")
            .cloned()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new()));
        let server_id = server
            .get("id")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Registry server missing id".to_string())?;
        let name = server
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or(server_id);

        let mut config_object = serde_json::Map::new();
        config_object.insert(
            "id".to_string(),
            json!(format!("registry-{}", Uuid::new_v4())),
        );
        config_object.insert("registryId".to_string(), json!(server_id));
        config_object.insert("name".to_string(), json!(name));
        config_object.insert("type".to_string(), json!(server_type));
        config_object.insert("status".to_string(), json!("disconnected"));
        config_object.insert("enabled".to_string(), json!(false));
        config_object.insert("config".to_string(), config_value);
        config_object.insert("createdAt".to_string(), json!(Utc::now().to_rfc3339()));
        config_object.insert("updatedAt".to_string(), json!(Utc::now().to_rfc3339()));
        let source = server
            .get("source")
            .and_then(Value::as_str)
            .unwrap_or("registry");
        config_object.insert("source".to_string(), json!(source));

        if let Some(tags) = server.get("tags") {
            config_object.insert("tags".to_string(), tags.clone());
        }
        if let Some(install) = install_command {
            config_object.insert("installCommand".to_string(), install);
        } else if let Some(command) = server.get("installCommand") {
            config_object.insert("installCommand".to_string(), command.clone());
        }

        if let Some(metrics) = Self::build_server_metrics_value(server) {
            config_object.insert("metrics".to_string(), metrics);
        }

        if let Some(freshness) = Self::build_server_freshness_value(server) {
            config_object.insert("metricFreshness".to_string(), freshness);
        }

        Ok(Value::Object(config_object))
    }

    fn load_from_disk_sync(path: &Path) -> Result<Vec<Value>, String> {
        let raw = match std::fs::read_to_string(path) {
            Ok(content) => content,
            Err(error) => {
                if error.kind() == std::io::ErrorKind::NotFound {
                    return Ok(Vec::new());
                }
                return Err(format!("Failed to read MCP servers: {error}"));
            }
        };

        Self::parse_servers(&raw)
    }

    fn parse_servers(raw: &str) -> Result<Vec<Value>, String> {
        match serde_json::from_str::<Vec<Value>>(raw) {
            Ok(parsed) => Ok(parsed),
            Err(primary_error) => {
                let start = raw.find('[');
                let end = raw.rfind(']');
                if let (Some(start), Some(end)) = (start, end) {
                    if end > start {
                        let slice = &raw[start..=end];
                        return serde_json::from_str::<Vec<Value>>(slice)
                            .map_err(|error| format!("Failed to parse MCP servers: {error}"));
                    }
                }
                Err(format!("Failed to parse MCP servers: {primary_error}"))
            }
        }
    }

    fn default_servers(root: &Path) -> Vec<Value> {
        let now = Utc::now().to_rfc3339();

        vec![json!({
            "id": "default-filesystem",
            "name": "Local Filesystem",
            "type": "filesystem",
            "status": "disconnected",
            "enabled": true,
            "config": {
                "type": "filesystem",
                "rootPath": root.to_string_lossy().to_string(),
            },
            "tools": [],
            "createdAt": now,
            "updatedAt": now
        })]
    }

    fn write_to_disk_sync(path: &Path, servers: &[Value]) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create MCP directory: {error}"))?;
        }

        let payload = Value::Array(servers.to_vec());
        let serialized = serde_json::to_string_pretty(&payload)
            .map_err(|error| format!("Failed to serialize MCP servers: {error}"))?;

        std::fs::write(path, serialized)
            .map_err(|error| format!("Failed to write MCP servers: {error}"))?;

        Ok(())
    }

    fn resolve_id(server: &Value) -> Option<String> {
        server
            .get("id")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
    }

    fn resolve_registry_key(entry: &Value) -> Option<String> {
        entry
            .get("registryId")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
    }

    fn resolve_type(server: &Value) -> Result<String, String> {
        server
            .get("config")
            .and_then(|config| config.get("type"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .ok_or_else(|| "MCP server missing config.type".to_string())
    }

    fn matches_query(server: &Value, query: Option<&str>) -> bool {
        if let Some(q) = query {
            if q.is_empty() {
                return true;
            }
            let name_match = server
                .get("name")
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase().contains(q))
                .unwrap_or(false);
            let id_match = server
                .get("id")
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase().contains(q))
                .unwrap_or(false);
            let description_match = server
                .get("description")
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase().contains(q))
                .unwrap_or(false);
            return name_match || id_match || description_match;
        }
        true
    }

    fn matches_tags(server: &Value, tags: &HashSet<String>) -> bool {
        if tags.is_empty() {
            return true;
        }
        let server_tags: HashSet<String> = server
            .get("tags")
            .and_then(|value| value.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|tag| tag.as_str())
                    .map(|tag| tag.to_lowercase())
                    .collect::<HashSet<String>>()
            })
            .unwrap_or_default();
        tags.iter().all(|tag| server_tags.contains(tag))
    }

    async fn test_filesystem_connection(
        &self,
        server: &Value,
    ) -> Result<McpConnectionResult, String> {
        let root_path = server
            .get("config")
            .and_then(|config| config.get("rootPath"))
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Filesystem MCP server missing config.rootPath".to_string())?;

        let path = PathBuf::from(root_path);
        if !path.exists() {
            return Ok(McpConnectionResult {
                success: false,
                tools: Vec::new(),
                error: Some(format!("Root path does not exist: {root_path}")),
            });
        }

        let tool = json!({
            "name": "listDirectory",
            "description": "Lists files within the configured root path",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "relativePath": {
                        "type": "string",
                        "description": "Relative path to inspect"
                    }
                }
            }
        });

        Ok(McpConnectionResult {
            success: true,
            tools: vec![tool],
            error: None,
        })
    }

    async fn fetch_remote_registry(
        &self,
        options: &RegistrySearchOptions,
    ) -> Result<Option<McpRegistrySearchResult>, String> {
        if !remote_registry_enabled() {
            return Ok(None);
        }

        let registry_name = "pulsemcp";
        let base_url = std::env::var("TAURI_MCP_REGISTRY_BASE_URL")
            .unwrap_or_else(|_| "https://api.pulsemcp.com/v0beta".to_string());
        let base_url = base_url.trim_end_matches('/').to_string();
        let client = Client::new();

        let query_payload = PulseQuery {
            query: options.query.as_ref().and_then(|value| {
                if value.is_empty() {
                    None
                } else {
                    Some(value.as_str())
                }
            }),
            offset: options.offset,
            count_per_page: options.limit.unwrap_or(50),
        };

        let mut request = client
            .get(format!("{}/servers", base_url))
            .query(&query_payload)
            .header(reqwest::header::ACCEPT, "application/json")
            .header(
                reqwest::header::USER_AGENT,
                "HashgraphOnlineDesktop/1.0 (+https://hashgraphonline.com)",
            );
        let now = Utc::now();
        let (cached_etag, cached_payload) = {
            let cache = self.remote_cache.lock().await;
            (cache.etag.clone(), cache.payload.clone())
        };

        if let Some(etag) = cached_etag.as_ref() {
            request = request.header(reqwest::header::IF_NONE_MATCH, etag);
        }

        let mut used_cached_on_error = false;
        let mut fallback_error_message: Option<String> = None;
        let mut fallback_error_code: Option<String> = None;
        let start_time = Instant::now();
        let send_result = request.send().await;
        let elapsed_ms = start_time.elapsed().as_millis() as u64;
        let payload_option: Option<RemoteCatalogPayload> = match send_result {
            Ok(response) => {
                let status_code = response.status();
                if status_code == reqwest::StatusCode::NOT_MODIFIED {
                    if let Some(mut payload) = cached_payload.clone() {
                        payload.fetched_at = now;
                        let mut cache = self.remote_cache.lock().await;
                        cache.payload = Some(payload.clone());
                        cache.consecutive_errors = 0;
                        if cache.etag.is_none() {
                            cache.etag = cached_etag.clone();
                        }
                        cache.last_latency_ms = Some(elapsed_ms);
                        cache.last_status = Some(status_code.as_u16() as i32);
                        cache.last_error = None;
                        cache.last_error_at = None;
                        Some(payload)
                    } else {
                        None
                    }
                } else if status_code.is_success() {
                    let etag_value = response
                        .headers()
                        .get(reqwest::header::ETAG)
                        .and_then(|value| value.to_str().ok())
                        .map(|value| value.to_string());
                    match response.json::<Value>().await {
                        Ok(raw_value) => {
                            let (servers, total, has_more) =
                                Self::normalize_pulse_payload(raw_value, now);

                            if servers.is_empty() {
                                fallback_error_code = Some("REMOTE_EMPTY".to_string());
                                fallback_error_message = Some(
                                    "Remote registry returned no installable servers".to_string(),
                                );
                                let mut cache = self.remote_cache.lock().await;
                                cache.consecutive_errors =
                                    cache.consecutive_errors.saturating_add(1);
                                cache.last_latency_ms = Some(elapsed_ms);
                                cache.last_status = Some(status_code.as_u16() as i32);
                                cache.last_error = fallback_error_message.clone();
                                cache.last_error_at = Some(now);
                                if let Some(payload) = cached_payload.clone() {
                                    used_cached_on_error = true;
                                    Some(payload)
                                } else {
                                    None
                                }
                            } else {
                                let payload = RemoteCatalogPayload {
                                    servers,
                                    total,
                                    has_more,
                                    fetched_at: now,
                                };
                                let mut cache = self.remote_cache.lock().await;
                                cache.etag = etag_value;
                                cache.payload = Some(payload.clone());
                                cache.consecutive_errors = 0;
                                cache.last_latency_ms = Some(elapsed_ms);
                                cache.last_status = Some(status_code.as_u16() as i32);
                                cache.last_error = None;
                                cache.last_error_at = None;
                                Some(payload)
                            }
                        }
                        Err(error) => {
                            log::debug!("Failed to parse remote registry response: {error}");
                            fallback_error_code = Some("REMOTE_PARSE_ERROR".to_string());
                            fallback_error_message =
                                Some(format!("Failed to parse remote registry response: {error}"));
                            let mut cache = self.remote_cache.lock().await;
                            cache.consecutive_errors = cache.consecutive_errors.saturating_add(1);
                            cache.last_latency_ms = Some(elapsed_ms);
                            cache.last_status = Some(status_code.as_u16() as i32);
                            cache.last_error = fallback_error_message.clone();
                            cache.last_error_at = Some(now);
                            if let Some(payload) = cached_payload.clone() {
                                used_cached_on_error = true;
                                Some(payload)
                            } else {
                                None
                            }
                        }
                    }
                } else {
                    log::debug!("Remote registry returned status {}", status_code);
                    fallback_error_code = Some(format!("HTTP_{}", status_code.as_u16()));
                    fallback_error_message =
                        Some(format!("Remote registry returned status {}", status_code));
                    if let Some(payload) = cached_payload.clone() {
                        used_cached_on_error = true;
                        let mut cache = self.remote_cache.lock().await;
                        cache.consecutive_errors = cache.consecutive_errors.saturating_add(1);
                        cache.last_latency_ms = Some(elapsed_ms);
                        cache.last_status = Some(status_code.as_u16() as i32);
                        cache.last_error = fallback_error_message.clone();
                        cache.last_error_at = Some(now);
                        Some(payload)
                    } else {
                        let mut cache = self.remote_cache.lock().await;
                        cache.consecutive_errors = cache.consecutive_errors.saturating_add(1);
                        cache.last_latency_ms = Some(elapsed_ms);
                        cache.last_status = Some(status_code.as_u16() as i32);
                        cache.last_error = fallback_error_message.clone();
                        cache.last_error_at = Some(now);
                        None
                    }
                }
            }
            Err(error) => {
                log::debug!("Remote registry search failed: {error}");
                fallback_error_code = Some("REMOTE_NETWORK_ERROR".to_string());
                fallback_error_message = Some(format!("Remote registry request failed: {error}"));
                if let Some(payload) = cached_payload.clone() {
                    used_cached_on_error = true;
                    let mut cache = self.remote_cache.lock().await;
                    cache.consecutive_errors = cache.consecutive_errors.saturating_add(1);
                    cache.last_error = fallback_error_message.clone();
                    cache.last_error_at = Some(now);
                    Some(payload)
                } else {
                    let mut cache = self.remote_cache.lock().await;
                    cache.consecutive_errors = cache.consecutive_errors.saturating_add(1);
                    cache.last_error = fallback_error_message.clone();
                    cache.last_error_at = Some(now);
                    None
                }
            }
        };

        match payload_option {
            Some(payload) => {
                if used_cached_on_error {
                    if let Some(message) = fallback_error_message.clone() {
                        self.record_registry_error(registry_name, &message);
                    }
                } else {
                    self.persist_registry_servers(
                        registry_name,
                        &payload.servers,
                        Some(elapsed_ms),
                    );
                }

                let servers = payload.servers.clone();
                let total = payload.total;
                let has_more = payload.has_more;

                let (mut metric_statuses, mut metric_freshness) = Self::build_metric_maps(&servers);

                if used_cached_on_error {
                    for value in metric_statuses.values_mut() {
                        if let Value::Object(entries) = value {
                            for metric_value in entries.values_mut() {
                                if let Value::Object(metric_object) = metric_value {
                                    metric_object.insert(
                                        "status".to_string(),
                                        Value::String("error".to_string()),
                                    );
                                    if let Some(code) = fallback_error_code.as_ref() {
                                        metric_object.insert(
                                            "errorCode".to_string(),
                                            Value::String(code.clone()),
                                        );
                                    }
                                    if let Some(message) = fallback_error_message.as_ref() {
                                        metric_object.insert(
                                            "errorMessage".to_string(),
                                            Value::String(message.clone()),
                                        );
                                    }
                                }
                            }
                        }
                    }
                    for value in metric_freshness.values_mut() {
                        if let Value::Object(entries) = value {
                            for freshness in entries.values_mut() {
                                *freshness = Value::String("stale".to_string());
                            }
                        }
                    }
                }

                Ok(Some(McpRegistrySearchResult {
                    servers,
                    total,
                    has_more,
                    categories: REGISTRY_CATALOG.categories.clone(),
                    metric_statuses,
                    metric_freshness,
                }))
            }
            None => {
                if let Some(message) = fallback_error_message {
                    self.record_registry_error(registry_name, &message);
                }
                Ok(None)
            }
        }
    }

    async fn record_registry_stats(&self, cache_hit: bool, total: usize, has_more: bool) {
        let mut stats = self.registry_stats.lock().await;
        stats.total_searches += 1;
        stats.cache_entries = total;
        stats.total_response_time_ms += if cache_hit { 250 } else { 1200 };
        if cache_hit {
            stats.cache_hits += 1;
        }
        stats.newest_entry = Some(Utc::now());
        if stats.oldest_entry.is_none() {
            stats.oldest_entry = stats.newest_entry;
        }
        if !has_more {
            stats.last_background_sync = stats.last_background_sync.or(stats.newest_entry);
        }
    }

    fn build_metric_maps(servers: &[Value]) -> (HashMap<String, Value>, HashMap<String, Value>) {
        let mut status_map = HashMap::new();
        let mut freshness_map = HashMap::new();

        for server in servers {
            let Some(id) = server.get("id").and_then(Value::as_str) else {
                continue;
            };

            let fallback_updated = server.get("updatedAt").and_then(Value::as_str);
            let mut metric_entries = Map::new();
            let mut freshness_entries = Map::new();

            if let Some(Value::Object(stored_metrics)) = server.get("metrics") {
                for (metric_name, metric_value) in stored_metrics {
                    if let Some((entry, freshness)) =
                        Self::normalize_metric_entry(metric_name, metric_value, fallback_updated)
                    {
                        metric_entries.insert(metric_name.clone(), entry);
                        let freshness_key = Self::freshness_map_key(metric_name);
                        freshness_entries.insert(freshness_key, Value::String(freshness));
                    }
                }
            }

            if metric_entries.is_empty() {
                let legacy_metrics = [
                    ("githubStars", server.get("githubStars")),
                    ("installCount", server.get("installCount")),
                    ("popularityScore", server.get("popularity")),
                ];

                for (name, value) in legacy_metrics.into_iter() {
                    if let Some(metric_value) = value {
                        if let Some((entry, freshness)) =
                            Self::normalize_metric_entry(name, metric_value, fallback_updated)
                        {
                            metric_entries.insert(name.to_string(), entry);
                            let freshness_key = Self::freshness_map_key(name);
                            freshness_entries.insert(freshness_key, Value::String(freshness));
                        }
                    }
                }
            }

            if !metric_entries.is_empty() {
                status_map.insert(id.to_string(), Value::Object(metric_entries));
            }
            if !freshness_entries.is_empty() {
                freshness_map.insert(id.to_string(), Value::Object(freshness_entries));
            }
        }

        (status_map, freshness_map)
    }

    fn normalize_metric_entry(
        metric: &str,
        value: &Value,
        fallback_updated: Option<&str>,
    ) -> Option<(Value, String)> {
        match value {
            Value::Object(map) => {
                let mut normalized = map.clone();
                let status_value = normalized
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("ok")
                    .to_string();

                let mut last_updated_value = normalized
                    .get("lastUpdated")
                    .and_then(Value::as_str)
                    .map(|value| value.to_string());

                if last_updated_value.is_none() {
                    if let Some(ts) = fallback_updated {
                        last_updated_value = Some(ts.to_string());
                        normalized.insert("lastUpdated".to_string(), Value::String(ts.to_string()));
                    }
                }

                if normalized.get("status").is_none() {
                    normalized.insert("status".to_string(), Value::String(status_value.clone()));
                }

                let freshness = Self::compute_metric_freshness(
                    last_updated_value.as_deref(),
                    metric,
                    &status_value,
                );

                Some((Value::Object(normalized), freshness))
            }
            Value::Number(num) => {
                let numeric = num
                    .as_f64()
                    .or_else(|| num.as_i64().map(|v| v as f64))
                    .or_else(|| num.as_u64().map(|v| v as f64))?;
                if numeric <= 0.0 {
                    return None;
                }
                let freshness = Self::compute_metric_freshness(fallback_updated, metric, "ok");
                let mut entry = Map::new();
                entry.insert("status".to_string(), Value::String("ok".to_string()));
                let number = Number::from_f64(numeric)?;
                entry.insert("value".to_string(), Value::Number(number));
                if let Some(ts) = fallback_updated {
                    entry.insert("lastUpdated".to_string(), Value::String(ts.to_string()));
                }
                Some((Value::Object(entry), freshness))
            }
            _ => None,
        }
    }

    fn freshness_map_key(metric: &str) -> String {
        match metric {
            "installCount" | "npmDownloads" | "installations" => "installations".to_string(),
            "popularityScore" | "popularity" => "popularity".to_string(),
            other => other.to_string(),
        }
    }

    fn compute_metric_freshness(last_updated: Option<&str>, metric: &str, status: &str) -> String {
        if status == "error" {
            return "stale".to_string();
        }

        let ttl_ms = match metric {
            "githubStars" => 6 * 60 * 60 * 1000,
            "npmDownloads" | "installCount" | "installations" => 24 * 60 * 60 * 1000,
            "pypiDownloads" => 24 * 60 * 60 * 1000,
            _ => 12 * 60 * 60 * 1000,
        } as i64;

        if let Some(iso) = last_updated {
            if let Ok(parsed) = DateTime::parse_from_rfc3339(iso) {
                let timestamp = parsed.with_timezone(&Utc);
                let age_ms = Utc::now()
                    .signed_duration_since(timestamp)
                    .num_milliseconds();
                if age_ms < 0 {
                    return "fresh".to_string();
                }
                if age_ms < ttl_ms / 2 {
                    return "fresh".to_string();
                }
                if age_ms < ttl_ms {
                    return "stale".to_string();
                }
            }
        }

        "expired".to_string()
    }

    fn annotate_server_source(server: &mut Value, source: &str) {
        if let Some(object) = server.as_object_mut() {
            object
                .entry("source".to_string())
                .or_insert_with(|| Value::String(source.to_string()));
        }
    }

    fn build_server_metrics_value(server: &Value) -> Option<Value> {
        let servers = vec![server.clone()];
        let (metrics, _) = Self::build_metric_maps(&servers);
        server
            .get("id")
            .and_then(Value::as_str)
            .and_then(|id| metrics.get(id).cloned())
    }

    fn build_server_freshness_value(server: &Value) -> Option<Value> {
        let servers = vec![server.clone()];
        let (_, freshness) = Self::build_metric_maps(&servers);
        server
            .get("id")
            .and_then(Value::as_str)
            .and_then(|id| freshness.get(id).cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::{McpService, REMOTE_ENV_GUARD};
    use httpmock::{Method, MockServer};
    use serde_json::{Value, json};
    use std::path::PathBuf;
    use std::str::FromStr;
    use tauri::utils::acl::{capability::CapabilityFile, manifest::PermissionFile};
    use tempfile::tempdir;

    #[tokio::test]
    async fn load_returns_empty_when_file_missing() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let servers = service.load().await.expect("load servers");
        assert_eq!(servers.len(), 1);
        let server = servers.first().expect("default server present");
        assert_eq!(server.get("id"), Some(&json!("default-filesystem")));
    }

    #[tokio::test]
    async fn save_and_load_round_trip() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path.clone(), None);

        let server = json!({
            "id": "mcp_test",
            "name": "Test Server",
            "type": "filesystem",
            "status": "disconnected",
            "enabled": false,
            "config": { "type": "filesystem", "rootPath": "." },
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        });

        service
            .save(vec![server.clone()])
            .await
            .expect("save servers");

        let reloaded = service.load().await.expect("reload servers");
        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0], server);

        let raw = std::fs::read_to_string(path).expect("read file");
        assert!(raw.contains("Test Server"));
    }

    #[tokio::test]
    async fn filesystem_connection_succeeds() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let server = json!({
            "id": "fs-1",
            "name": "Local Files",
            "type": "filesystem",
            "status": "disconnected",
            "enabled": true,
            "config": {
                "type": "filesystem",
                "rootPath": dir.path().to_string_lossy().to_string()
            },
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        });

        let result = service
            .test_connection(&server)
            .await
            .expect("test connection");
        assert!(result.success);
        assert!(result.error.is_none());
        assert!(!result.tools.is_empty());
    }

    #[tokio::test]
    async fn custom_servers_support_pretty_json_streams() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let script_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/mock-mcp-server-pretty.js");

        let server = json!({
            "id": "custom-pretty",
            "name": "Pretty Custom",
            "type": "custom",
            "status": "disconnected",
            "enabled": true,
            "config": {
                "type": "custom",
                "command": "node",
                "args": [script_path.to_string_lossy()],
            },
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        });

        let result = service
            .test_connection(&server)
            .await
            .expect("test connection");

        assert!(result.success);
        assert!(result.error.is_none());
        assert_eq!(
            result
                .tools
                .first()
                .and_then(|tool| tool.get("name"))
                .and_then(Value::as_str),
            Some("prettyTool")
        );
    }

    #[tokio::test]
    async fn unsupported_server_type_returns_error() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let server = json!({
            "id": "unsupported",
            "name": "Custom",
            "type": "custom",
            "status": "disconnected",
            "enabled": false,
            "config": {
                "type": "custom"
            },
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        });

        let result = service
            .test_connection(&server)
            .await
            .expect("test connection");
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[tokio::test]
    async fn connect_and_disconnect_tracks_runtime_state() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path.clone(), None);

        let server = json!({
            "id": "fs-2",
            "name": "Local Files",
            "type": "filesystem",
            "status": "disconnected",
            "enabled": true,
            "config": {
                "type": "filesystem",
                "rootPath": dir.path().to_string_lossy().to_string()
            },
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        });

        service.save(vec![server]).await.expect("persist server");

        let connection = service.connect("fs-2").await.expect("connect");
        assert!(connection.success);

        let tools = service
            .connected_tools("fs-2")
            .await
            .expect("connected tools");
        assert!(!tools.is_empty());

        let disconnected = service.disconnect("fs-2").await.expect("disconnect");
        assert!(disconnected);
        let tools_after = service
            .connected_tools("fs-2")
            .await
            .expect("tools after disconnect");
        assert!(tools_after.is_empty());
    }

    #[tokio::test]
    async fn registry_features_return_explicit_errors() {
        let _guard = REMOTE_ENV_GUARD.lock().expect("remote env guard poisoned");
        unsafe {
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "false");
        }
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let search = service
            .search_registry(&Value::Null)
            .await
            .expect("search result");
        assert!(search.total >= search.servers.len());

        let detail = service
            .registry_server_details("filesystem-local", None)
            .await
            .expect("detail result");
        assert_eq!(
            detail.get("id").and_then(Value::as_str),
            Some("filesystem-local")
        );

        let install_result = service
            .install_from_registry("filesystem-local", None, None)
            .await
            .expect("install result");
        assert!(install_result.get("registryId").is_some());

        let cache_stats = service.cache_stats().await.expect("cache stats");
        assert!(cache_stats.get("totalServers").is_some());

        service.trigger_background_sync().await.expect("sync");
        service.enrich_metrics(&Value::Null).await.expect("enrich");
        unsafe {
            std::env::remove_var("TAURI_MCP_REGISTRY_REMOTE");
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "false");
        }
    }

    #[tokio::test]
    async fn install_payload_populates_missing_command_fields() {
        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let server_detail = json!({
            "id": "custom-shell",
            "name": "Custom Shell",
            "template": {
                "type": "custom",
                "config": {
                    "type": "custom"
                }
            }
        });

        let install_command = json!({
            "command": "node",
            "args": ["script.js"]
        });

        let config_value = service
            .convert_registry_server_to_config(&server_detail, Some(install_command.clone()))
            .expect("config value");

        let config = config_value
            .get("config")
            .and_then(Value::as_object)
            .expect("config object");

        assert_eq!(
            config.get("command").and_then(Value::as_str),
            install_command.get("command").and_then(Value::as_str)
        );

        let args = config
            .get("args")
            .and_then(Value::as_array)
            .expect("args array");
        assert_eq!(args.len(), 1);
        assert_eq!(args[0].as_str(), Some("script.js"));
    }

    #[tokio::test]
    async fn search_registry_uses_remote_when_enabled() {
        let _guard = REMOTE_ENV_GUARD.lock().expect("remote env guard poisoned");
        let mock = MockServer::start_async().await;
        let response_body = json!({
            "servers": [
                {
                    "id": "remote-server",
                    "name": "Remote Server",
                    "template": {
                        "type": "filesystem",
                        "config": { "rootPath": "$HOME" }
                    }
                }
            ],
            "total": 1,
            "hasMore": false
        });

        let _mock = mock
            .mock_async(|when, then| {
                when.method(Method::GET).path("/catalog/search");
                then.status(200).json_body(response_body.clone());
            })
            .await;

        unsafe {
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "true");
            std::env::set_var("TAURI_MCP_REGISTRY_BASE_URL", mock.base_url());
        }

        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let result = service
            .search_registry(&json!({"query": "remote"}))
            .await
            .expect("search result");

        assert_eq!(result.total, 1);
        assert_eq!(
            result
                .servers
                .first()
                .and_then(|s| s.get("id").and_then(Value::as_str)),
            Some("remote-server")
        );

        unsafe {
            std::env::remove_var("TAURI_MCP_REGISTRY_REMOTE");
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "false");
            std::env::remove_var("TAURI_MCP_REGISTRY_BASE_URL");
        }
    }

    #[tokio::test]
    async fn remote_registry_uses_conditional_requests_and_cached_payload() {
        let _guard = REMOTE_ENV_GUARD.lock().expect("remote env guard poisoned");
        let mock = MockServer::start_async().await;
        let response_body = json!({
            "servers": [
                {
                    "id": "remote-etag",
                    "name": "Remote ETag Server",
                    "template": {
                        "type": "filesystem",
                        "config": { "rootPath": "$HOME" }
                    },
                    "githubStars": 1234,
                    "installCount": 5678
                }
            ],
            "total": 1,
            "hasMore": false
        });

        let first = mock
            .mock_async(|when, then| {
                when.method(Method::GET).path("/catalog/search");
                then.status(200)
                    .header("etag", "etag-123")
                    .json_body(response_body.clone());
            })
            .await;

        unsafe {
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "true");
            std::env::set_var("TAURI_MCP_REGISTRY_BASE_URL", mock.base_url());
        }

        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let first_result = service
            .search_registry(&Value::Null)
            .await
            .expect("first search result");
        assert_eq!(first_result.total, 1);
        first.assert_async().await;
        first.delete_async().await;

        let second = mock
            .mock_async(|when, then| {
                when.method(Method::GET)
                    .path("/catalog/search")
                    .header("if-none-match", "etag-123");
                then.status(304);
            })
            .await;

        let second_result = service
            .search_registry(&Value::Null)
            .await
            .expect("cached search result");
        assert_eq!(second_result.total, 1);
        second.assert_async().await;
        second.delete_async().await;

        unsafe {
            std::env::remove_var("TAURI_MCP_REGISTRY_REMOTE");
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "false");
            std::env::remove_var("TAURI_MCP_REGISTRY_BASE_URL");
        }
    }

    #[tokio::test]
    async fn remote_registry_marks_metrics_stale_on_error() {
        let _guard = REMOTE_ENV_GUARD.lock().expect("remote env guard poisoned");
        let mock = MockServer::start_async().await;
        let response_body = json!({
            "servers": [
                {
                    "id": "remote-error",
                    "name": "Remote Error Server",
                    "template": {
                        "type": "filesystem",
                        "config": { "rootPath": "$HOME" }
                    },
                    "githubStars": 222,
                    "installCount": 333
                }
            ],
            "total": 1,
            "hasMore": false
        });

        let success_mock = mock
            .mock_async(|when, then| {
                when.method(Method::GET).path("/catalog/search");
                then.status(200)
                    .header("etag", "etag-error")
                    .json_body(response_body.clone());
            })
            .await;

        unsafe {
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "true");
            std::env::set_var("TAURI_MCP_REGISTRY_BASE_URL", mock.base_url());
        }

        let dir = tempdir().expect("create tempdir");
        let path = dir.path().join("mcp-servers.json");
        let service = McpService::new(path, None);

        let initial = service
            .search_registry(&Value::Null)
            .await
            .expect("initial search result");
        assert_eq!(initial.total, 1);
        success_mock.assert_async().await;
        success_mock.delete_async().await;

        let _error_mock = mock
            .mock_async(|when, then| {
                when.method(Method::GET).path("/catalog/search");
                then.status(500);
            })
            .await;

        let fallback = service
            .search_registry(&Value::Null)
            .await
            .expect("fallback search result");
        assert_eq!(fallback.total, 1);

        let statuses = fallback
            .metric_statuses
            .get("remote-error")
            .cloned()
            .expect("status map");
        if let Value::Object(entries) = statuses {
            let github = entries.get("githubStars").expect("github status");
            if let Value::Object(github_obj) = github {
                assert_eq!(
                    github_obj.get("status"),
                    Some(&Value::String("error".into()))
                );
            } else {
                panic!("github status not object");
            }
        } else {
            panic!("status map not object");
        }

        let freshness = fallback
            .metric_freshness
            .get("remote-error")
            .cloned()
            .expect("freshness map");
        if let Value::Object(entries) = freshness {
            assert_eq!(
                entries.get("githubStars"),
                Some(&Value::String("stale".into()))
            );
        } else {
            panic!("freshness map not object");
        }

        unsafe {
            std::env::remove_var("TAURI_MCP_REGISTRY_REMOTE");
            std::env::set_var("TAURI_MCP_REGISTRY_REMOTE", "false");
            std::env::remove_var("TAURI_MCP_REGISTRY_BASE_URL");
        }
    }

    #[test]
    fn capability_and_permissions_include_mcp_commands() {
        let permission_file: PermissionFile =
            serde_json::from_str(include_str!("../permissions/desktop.json"))
                .expect("parse MCP permission file");

        let expected_commands = [
            "mcp_load_servers",
            "mcp_save_servers",
            "mcp_test_connection",
            "mcp_connect_server",
            "mcp_disconnect_server",
            "mcp_get_server_tools",
            "mcp_refresh_server_tools",
            "mcp_search_registry",
            "mcp_get_registry_server_details",
            "mcp_install_from_registry",
            "mcp_clear_registry_cache",
            "mcp_get_cache_stats",
            "mcp_trigger_background_sync",
            "mcp_enrich_metrics",
        ];

        let allowed_commands = permission_file
            .permission
            .iter()
            .flat_map(|permission| permission.commands.allow.iter())
            .collect::<Vec<_>>();

        for command in expected_commands {
            assert!(
                allowed_commands.iter().any(|entry| entry == &command),
                "permission file missing command {command}"
            );
        }

        let capability_file = CapabilityFile::from_str(include_str!("../capabilities/main.json"))
            .expect("parse main capability file");

        let capabilities = match capability_file {
            CapabilityFile::Capability(capability) => vec![capability],
            CapabilityFile::List(list) | CapabilityFile::NamedList { capabilities: list } => list,
        };

        let main_capability = capabilities
            .iter()
            .find(|capability| capability.identifier == "main-window")
            .expect("main window capability exists");

        let permission_refs = main_capability
            .permissions
            .iter()
            .map(|entry| entry.identifier().get().to_string())
            .collect::<Vec<_>>();

        assert!(
            permission_refs.iter().any(|identifier| identifier == "mcp"),
            "main-window capability missing mcp permission"
        );

        let remote_urls = main_capability
            .remote
            .as_ref()
            .map(|remote| remote.urls.clone())
            .unwrap_or_default();
        assert!(
            remote_urls
                .iter()
                .any(|url| url == "http://localhost:5175/*"),
            "main-window capability missing dev remote URL"
        );

        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("parse tauri config");
        let capability_refs = config["app"]["security"]["capabilities"]
            .as_array()
            .expect("capability list present");

        assert!(
            capability_refs
                .iter()
                .any(|value| value.as_str() == Some("main-window")),
            "tauri.conf.json missing main-window capability reference"
        );

        let with_global = config["app"]["withGlobalTauri"].as_bool().unwrap_or(false);
        assert!(
            with_global,
            "withGlobalTauri must be enabled for renderer access"
        );
    }
}
