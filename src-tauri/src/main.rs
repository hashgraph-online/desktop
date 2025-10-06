#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent;
mod agent_backend;
mod agent_services;
#[cfg(not(test))]
mod browser;
mod config;
mod connection;
mod credentials;
mod entity;
mod hcs10;
mod logging;
mod mcp;
mod mcp_registry;
mod mirror;
mod node_agent;
mod session;
mod transaction_parser;
mod wallet_bridge;

pub use agent_backend::{AgentBackend, BackendError, EchoAgent};
#[cfg(test)]
mod browser {
    use serde::{Deserialize, Serialize};
    use serde_json::Value;
    use std::marker::PhantomData;
    use tauri::AppHandle;
    use tauri::Runtime;

    #[derive(Clone, Serialize, Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    pub struct BrowserStateDto {}

    #[derive(Clone, Serialize, Deserialize, Default)]
    pub struct BoundsPayload {}

    #[derive(Clone, Serialize, Deserialize, Default)]
    pub struct LayoutPayload {}

    pub struct BrowserManager<R: Runtime>(PhantomData<R>);

    unsafe impl<R: Runtime> Send for BrowserManager<R> {}
    unsafe impl<R: Runtime> Sync for BrowserManager<R> {}

    impl<R: Runtime> BrowserManager<R> {
        pub fn new(_default_url: Option<String>) -> Self {
            Self(PhantomData)
        }

        pub async fn attach(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }

        pub async fn detach(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }

        pub async fn navigate(&self, _app: &AppHandle<R>, _url: String) -> Result<(), String> {
            Ok(())
        }

        pub async fn reload(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }

        pub async fn go_back(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }

        pub async fn go_forward(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }

        pub async fn capture_context(&self, _app: &AppHandle<R>) -> Result<Option<Value>, String> {
            Ok(None)
        }

        pub async fn set_bounds(
            &self,
            _app: &AppHandle<R>,
            _bounds: BoundsPayload,
        ) -> Result<(), String> {
            Ok(())
        }

        pub async fn set_layout(
            &self,
            _app: &AppHandle<R>,
            _layout: LayoutPayload,
        ) -> Result<(), String> {
            Ok(())
        }

        pub async fn get_state(&self) -> Result<BrowserStateDto, String> {
            Ok(BrowserStateDto {})
        }

        pub async fn execute_js(
            &self,
            _app: &AppHandle<R>,
            _script: String,
        ) -> Result<Value, String> {
            Ok(Value::Null)
        }

        pub async fn open_devtools(&self, _app: &AppHandle<R>) -> Result<(), String> {
            Ok(())
        }
    }
}
#[cfg(test)]
use browser::{BrowserManager, BrowserStateDto};
#[cfg(not(test))]
use browser::{BrowserManager, BrowserStateDto};

#[cfg(test)]
mod main_tests;

use agent::{
    AgentInitializeConfig, AgentInitializeResponse, AgentMessageRequest, AgentMessageResponse,
    AgentService, AgentSessionContext, AgentStatusResponse,
};
use chrono::{DateTime, Duration, Utc};
use config::{
    ConfigState, LoadConfigResponse, Network, StoredHcs10Profile, load_config, plugin_disable,
    plugin_enable, save_config, set_auto_start, set_log_level, set_theme,
};
use connection::{
    ConnectionService, HederaCredentials, HederaNetwork, HederaTestResponse, LlmCredentials,
    LlmTestResponse,
};
use credentials::CredentialManager;
use hcs10::{Hcs10Bridge, Hcs10Service};
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use session::{ChatMessage, ChatSession, CreateSessionInput, SessionContext, SessionService};
use std::borrow::Cow;
use std::collections::HashMap;
use std::convert::TryFrom;
use std::fs;
use std::io::Write as _;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tokio::sync::Mutex;
use tokio::time::{Duration as TokioDuration, sleep};

use crate::entity::{EntityAssociation, EntityService};
use crate::mcp::{
    McpConnectionResult, McpRegistrySearchResult, McpService, remote_registry_enabled,
};
use crate::mirror::{MirrorBridgeState, MirrorNetwork, MirrorNodeBridge};
use crate::transaction_parser::{TransactionParserBridge, TransactionParserState};
use crate::wallet_bridge::{
    WalletBridgeInfo, WalletBridgeState, wallet_execute_bytes, wallet_status_json,
};

type ActiveBrowserManager = BrowserManager<Wry>;

#[tauri::command]
fn version_info(app_handle: AppHandle) -> String {
    app_handle.package_info().version.to_string()
}

async fn initialize_mcp_service(handle: AppHandle<Wry>) {
    let servers = {
        let state = handle.state::<Mutex<McpService>>();
        let service = state.lock().await;
        match service.load().await {
            Ok(servers) => servers,
            Err(error) => {
                log::warn!("Failed to load MCP servers at startup: {}", error);
                Vec::new()
            }
        }
    };

    for server in servers {
        let enabled = server
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if !enabled {
            continue;
        }

        let Some(server_id) = server.get("id").and_then(Value::as_str) else {
            continue;
        };

        let state = handle.state::<Mutex<McpService>>();
        let service = state.lock().await;
        match service.connect(server_id).await {
            Ok(result) if result.success => {
                log::info!("Connected to MCP server {}", server_id);
            }
            Ok(result) => {
                let message = result
                    .error
                    .unwrap_or_else(|| "Unknown MCP connection failure".to_string());
                log::warn!(
                    "MCP server {} reported unsuccessful connection: {}",
                    server_id,
                    message
                );
            }
            Err(error) => {
                log::warn!(
                    "Failed to connect to MCP server {} during startup: {}",
                    server_id,
                    error
                );
            }
        }
    }
}

async fn schedule_mcp_background_sync(handle: AppHandle<Wry>) {
    if !remote_registry_enabled() {
        return;
    }

    sleep(TokioDuration::from_secs(30)).await;

    loop {
        {
            let state = handle.state::<Mutex<McpService>>();
            let service = state.lock().await;
            if let Err(error) = service.trigger_background_sync().await {
                log::debug!("Background MCP registry sync failed: {}", error);
            }
        }

        sleep(TokioDuration::from_secs(30 * 60)).await;
    }
}

fn main() {
    let _ = dotenvy::dotenv();
    let context = tauri::generate_context!();
    let master_password = std::env::var("MASTER_PASSWORD")
        .unwrap_or_else(|_| "default-secure-password-change-me".to_string());

    logging::init(LevelFilter::Info);

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(ConfigState::new(master_password.clone()))
        .manage(Mutex::new(
            ConnectionService::new().expect("Failed to initialize ConnectionService"),
        ))
        .manage(Mutex::new(AgentService::new()))
        .manage(WalletBridgeState::default())
        .manage(ActiveBrowserManager::new(None))
        .setup(move |app| {
            if app.try_state::<ActiveBrowserManager>().is_none() {
                log::error!("ActiveBrowserManager state not available during setup");
            } else {
                log::info!("ActiveBrowserManager state successfully registered");
            }
            let app_handle = app.handle();
            let config_dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;

            if !config_dir.exists() {
                fs::create_dir_all(&config_dir)?;
            }

            let credential_path = config_dir.join("credentials.dat");
            let session_db_path = config_dir.join("chat.sqlite");
            let mcp_path = config_dir.join("mcp-servers.json");
            let registry_db_path = config_dir.join("mcp-registry.sqlite");

            let credential_manager =
                CredentialManager::new(credential_path, master_password.clone());
            let session_service = SessionService::from_path(&session_db_path)?;
            let entity_service = EntityService::from_path(&session_db_path)?;
            let mcp_service = McpService::new(mcp_path, Some(registry_db_path));

            app.manage(Mutex::new(credential_manager));
            app.manage(Mutex::new(session_service));
            app.manage(Mutex::new(entity_service));
            app.manage(Mutex::new(mcp_service));
            let hcs10_bridge = resolve_hcs10_bridge_script(&app_handle).and_then(|script| {
                match tauri::async_runtime::block_on(Hcs10Bridge::spawn(script.clone())) {
                    Ok(bridge) => Some(Arc::new(bridge)),
                    Err(error) => {
                        log::warn!(
                            "Failed to spawn HCS10 bridge at {}: {}",
                            script.display(),
                            error
                        );
                        None
                    }
                }
            });
            let hcs10_service = Hcs10Service::new(hcs10_bridge, config_dir.join("hcs10-states"));
            app.manage(hcs10_service);
            let mirror_bridge =
                resolve_mirror_bridge_script(&app_handle).map(MirrorNodeBridge::new);
            app.manage(MirrorBridgeState::new(mirror_bridge));
            let transaction_bridge =
                resolve_transaction_parser_script(&app_handle).map(TransactionParserBridge::new);
            app.manage(TransactionParserState::new(transaction_bridge));
            app.manage(Arc::new(Mutex::new(None::<WalletBridgeInfo>)));

            let init_handle = app.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                initialize_mcp_service(init_handle.clone()).await;
            });

            let sync_handle = app.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                schedule_mcp_background_sync(sync_handle.clone()).await;
            });

            match resolve_bridge_script(&app_handle) {
                Some(bridge_path) => {
                    log::info!(
                        "Configuring conversational agent bridge: {}",
                        bridge_path.display()
                    );
                    let agent_service = app.state::<Mutex<AgentService>>();
                    tauri::async_runtime::block_on(async {
                        let guard = agent_service.lock().await;
                        guard.set_bridge_script(Some(bridge_path.clone())).await;
                        log::info!(
                            "Conversational agent bridge registered: {}",
                            bridge_path.display()
                        );
                    });
                }
                None => {
                    log::warn!(
                        "Conversational agent bridge script not found; falling back to echo backend"
                    );
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            version_info,
            load_config,
            save_config,
            set_theme,
            set_auto_start,
            set_log_level,
            plugin_enable,
            plugin_disable,
            config::get_environment_config,
            connection_test_hedera,
            connection_test_openai,
            connection_test_anthropic,
            agent_initialize,
            agent_status,
            agent_disconnect,
            agent_send_message,
            agent_update_session_context,
            chat_create_session,
            chat_load_session,
            chat_save_session,
            chat_delete_session,
            chat_load_all_sessions,
            chat_save_message,
            chat_load_session_messages,
            chat_update_session_context,
            chat_update_form_state,
            chat_update_message_metadata,
            credential_store,
            credential_get,
            credential_delete,
            credential_clear,
            mirror_node_get_schedule_info,
            mirror_node_get_scheduled_transaction_status,
            mirror_node_get_transaction_by_timestamp,
            mirror_node_get_transaction,
            mirror_node_get_token_info,
            transaction_parser_validate,
            transaction_parser_parse,
            execute_transaction_bytes,
            wallet_hydrate_entity,
            wallet_set_current,
            wallet_status,
            entity_get_all,
            entity_delete,
            entity_bulk_delete,
            entity_rename,
            entity_export,
            entity_get_by_id,
            entity_search,
            browser_attach,
            browser_detach,
            browser_navigate,
            browser_reload,
            browser_go_back,
            browser_go_forward,
            browser_set_bounds,
            browser_capture_context,
            browser_set_layout,
            browser_get_state,
            browser_execute_js,
            browser_open_devtools,
            browser_open_external,
            mcp_load_servers,
            mcp_save_servers,
            mcp_test_connection,
            mcp_connect_server,
            mcp_disconnect_server,
            mcp_get_server_tools,
            mcp_refresh_server_tools,
            mcp_search_registry,
            mcp_get_registry_server_details,
            mcp_install_from_registry,
            mcp_clear_registry_cache,
            mcp_get_cache_stats,
            mcp_trigger_background_sync,
            mcp_enrich_metrics,
            hcs10_register_profile,
            hcs10_validate_profile,
            hcs10_get_profiles,
            hcs10_get_registration_progress,
            hcs10_is_registration_in_progress,
            hcs10_cancel_registration,
            hcs10_clear_all_states,
            hcs10_retrieve_profile
        ])
        .run(context)
        .expect("failed to run Tauri application");
}

#[derive(Serialize)]
struct CommandResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> CommandResponse<T> {
    fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

fn filter_entities_in_place(
    entities: &mut Vec<EntityAssociation>,
    search: Option<&str>,
    date_range: Option<&EntityDateRangePayload>,
) {
    if let Some(search) = search {
        let search_lower = search.to_lowercase();
        entities.retain(|entity| {
            entity.entity_name.to_lowercase().contains(&search_lower)
                || entity.entity_id.to_lowercase().contains(&search_lower)
                || entity
                    .transaction_id
                    .as_ref()
                    .map(|value| value.to_lowercase().contains(&search_lower))
                    .unwrap_or(false)
        });
    }

    if let Some(range) = date_range {
        let start = range
            .start
            .as_deref()
            .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
            .map(|dt| dt.with_timezone(&Utc));
        let end = range
            .end
            .as_deref()
            .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
            .map(|dt| dt.with_timezone(&Utc));

        entities.retain(
            |entity| match DateTime::parse_from_rfc3339(&entity.created_at) {
                Ok(parsed) => {
                    let created = parsed.with_timezone(&Utc);
                    if let Some(start) = start {
                        if created < start {
                            return false;
                        }
                    }
                    if let Some(end) = end {
                        if created > end {
                            return false;
                        }
                    }
                    true
                }
                Err(_) => true,
            },
        );
    }
}

fn derive_entity_name(context: Option<&Value>, entity_type: &str, entity_id: &str) -> String {
    if let Some(name_value) = context
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
    {
        let trimmed = name_value.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    if let Some(description_value) = context
        .and_then(|value| value.get("description"))
        .and_then(Value::as_str)
    {
        let tokens: Vec<&str> = description_value.split_whitespace().collect();
        for window in tokens.windows(2) {
            let indicator = window[0]
                .trim_matches(|c: char| !c.is_ascii_alphabetic())
                .to_ascii_lowercase();
            if is_entity_indicator(&indicator) {
                let candidate = window[1]
                    .trim_matches(|c: char| !is_allowed_entity_char(c))
                    .to_string();
                if !candidate.trim().is_empty() {
                    return candidate.trim().to_string();
                }
            }
        }
    }

    if !entity_id.trim().is_empty() {
        return entity_id.to_string();
    }

    format!("{entity_type}_{}", Utc::now().timestamp())
}

fn is_entity_indicator(value: &str) -> bool {
    matches!(
        value,
        "token" | "account" | "topic" | "schedule" | "contract"
    )
}

fn is_allowed_entity_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_' || character == '-'
}

async fn persist_entity_association(
    app: &AppHandle<Wry>,
    entity_state: &State<'_, Mutex<EntityService>>,
    agent_state: &State<'_, Mutex<AgentService>>,
    entity_id: &str,
    entity_type: &str,
    entity_name: &str,
    transaction_id: Option<&String>,
    session_override: Option<&str>,
    metadata_value: &Value,
) -> Option<EntityAssociation> {
    let session_id = if let Some(override_id) = session_override {
        Some(override_id.to_string())
    } else {
        let agent_guard = agent_state.lock().await;
        agent_guard
            .session_context()
            .await
            .map(|context| context.session_id)
    };

    let persist_outcome = {
        let service = entity_state.lock().await;
        service
            .store_entity(
                entity_id,
                entity_name,
                entity_type,
                transaction_id.map(|value| value.as_str()),
                session_id.as_deref(),
                Some(metadata_value),
            )
            .await
    };

    match persist_outcome {
        Ok(result) => {
            let stored = result.entity.clone();
            if result.created {
                log::info!(
                    "persist_entity_association: stored new entity {} of type {}",
                    entity_id,
                    entity_type
                );
                if let Err(error) = app.emit("entity_created", stored.clone()) {
                    log::warn!(
                        "Failed to emit entity_created event for {}: {}",
                        entity_id,
                        error
                    );
                }
            }
            Some(stored)
        }
        Err(error) => {
            log::warn!(
                "Failed to persist entity association for {}: {}",
                entity_id,
                error
            );
            None
        }
    }
}

fn extract_transaction_id(value: &Value) -> Option<String> {
    value
        .get("transactionId")
        .and_then(Value::as_str)
        .map(|raw| raw.to_string())
        .or_else(|| {
            value
                .get("transaction_id")
                .and_then(Value::as_str)
                .map(|raw| raw.to_string())
        })
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("transactionId"))
                .and_then(Value::as_str)
                .map(|raw| raw.to_string())
        })
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("transaction_id"))
                .and_then(Value::as_str)
                .map(|raw| raw.to_string())
        })
}

fn extract_entity_from_response(value: &Value) -> Option<(String, String)> {
    let entity_id = value
        .get("entityId")
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("entityId"))
                .and_then(Value::as_str)
        })?
        .to_string();

    let entity_type = value
        .get("entityType")
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("entityType"))
                .and_then(Value::as_str)
        })
        .map(|raw| raw.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    Some((entity_id, entity_type))
}

async fn hydrate_entity_via_mirror(
    mirror_state: &MirrorBridgeState,
    transaction_id: &str,
    network: &str,
) -> Option<(String, String)> {
    let normalized_transaction_id = normalize_transaction_id_for_mirror(transaction_id);

    let Some(bridge) = mirror_state.bridge() else {
        log::debug!(
            "hydrate_entity_via_mirror: mirror bridge unavailable for transaction {}",
            transaction_id
        );
        return None;
    };

    let mirror_network = match MirrorNetwork::try_from_str(Some(network)) {
        Ok(value) => value,
        Err(error) => {
            log::warn!(
                "hydrate_entity_via_mirror: unsupported network '{}' for transaction {}: {}",
                network,
                transaction_id,
                error
            );
            return None;
        }
    };

    log::debug!(
        "hydrate_entity_via_mirror: polling mirror node for transaction {} (normalized: {})",
        transaction_id,
        normalized_transaction_id
    );

    for attempt in 1..=12 {
        match bridge
            .get_transaction(normalized_transaction_id.as_ref(), mirror_network)
            .await
        {
            Ok(Some(transaction)) => {
                if let Some(entity) = extract_entity_from_transaction(&transaction) {
                    log::info!(
                        "hydrate_entity_via_mirror: resolved entity {} (type {}) for transaction {} on attempt {}",
                        entity.0,
                        entity.1,
                        transaction_id,
                        attempt
                    );
                    return Some(entity);
                }
            }
            Ok(None) => {
                log::debug!(
                    "hydrate_entity_via_mirror: mirror returned no records for transaction {} (attempt {})",
                    transaction_id,
                    attempt
                );
            }
            Err(error) => {
                log::debug!(
                    "hydrate_entity_via_mirror: lookup error for transaction {} on attempt {}: {}",
                    transaction_id,
                    attempt,
                    error
                );
            }
        }

        sleep(TokioDuration::from_millis(500)).await;
    }

    log::warn!(
        "hydrate_entity_via_mirror: unable to resolve entity metadata for transaction {} after polling",
        transaction_id
    );
    None
}

fn normalize_transaction_id_for_mirror(transaction_id: &str) -> Cow<'_, str> {
    if let Some((account, remainder)) = transaction_id.split_once('@') {
        if account.is_empty() || remainder.is_empty() {
            return Cow::Owned(transaction_id.replace('@', "-"));
        }

        let mut parts = remainder.split('.');
        let seconds = parts.next().unwrap_or_default();
        let nanos = parts.next().unwrap_or_default();

        if !seconds.is_empty() && !nanos.is_empty() {
            let extra = parts.collect::<Vec<_>>().join("");
            let mut normalized_nanos = nanos.to_string();
            if !extra.is_empty() {
                normalized_nanos.push_str(&extra);
            }
            return Cow::Owned(format!("{}-{}-{}", account, seconds, normalized_nanos));
        }

        let sanitized = remainder.replace('.', "-");
        return Cow::Owned(format!("{}-{}", account, sanitized));
    }

    Cow::Borrowed(transaction_id)
}

fn extract_entity_from_transaction(transaction: &Value) -> Option<(String, String)> {
    let transaction_name = transaction.get("name").and_then(Value::as_str);
    let map_from_name = map_transaction_name_to_entity_type(transaction_name);

    let candidates: [(&str, Option<&str>); 7] = [
        ("entity_id", map_from_name.as_deref()),
        ("token_id", Some("tokenId")),
        ("schedule_id", Some("scheduleId")),
        ("topic_id", Some("topicId")),
        ("contract_id", Some("contractId")),
        ("file_id", Some("fileId")),
        ("account_id", Some("accountId")),
    ];

    for (key, explicit_type) in candidates {
        if let Some(id) = transaction.get(key).and_then(Value::as_str) {
            let entity_type = explicit_type
                .map(|value| value.to_string())
                .or_else(|| map_from_name.clone())
                .unwrap_or_else(|| infer_entity_type_from_key(key));
            return Some((id.to_string(), entity_type));
        }
    }

    None
}

fn infer_entity_type_from_key(key: &str) -> String {
    match key {
        "token_id" => "tokenId".to_string(),
        "schedule_id" => "scheduleId".to_string(),
        "topic_id" => "topicId".to_string(),
        "contract_id" => "contractId".to_string(),
        "file_id" => "fileId".to_string(),
        "account_id" => "accountId".to_string(),
        _ => "unknown".to_string(),
    }
}

fn enrich_transaction_response(
    value: &mut Value,
    entity_id: &str,
    entity_type: &str,
    entity_name: &str,
    transaction_id: Option<&str>,
) {
    if let Some(root) = value.as_object_mut() {
        let data_entry = root
            .entry("data".to_string())
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
        if let Some(data) = data_entry.as_object_mut() {
            data.insert("entityId".to_string(), Value::String(entity_id.to_string()));
            data.insert(
                "entityType".to_string(),
                Value::String(entity_type.to_string()),
            );
            data.insert(
                "entityName".to_string(),
                Value::String(entity_name.to_string()),
            );
            if let Some(tx_id) = transaction_id {
                data.entry("transactionId".to_string())
                    .or_insert_with(|| Value::String(tx_id.to_string()));
            }
        }
    }
}

fn map_transaction_name_to_entity_type(name: Option<&str>) -> Option<String> {
    let normalized = name?.to_ascii_uppercase();
    match normalized.as_str() {
        "TOKENCREATION" => Some("tokenId".to_string()),
        "CRYPTOCREATEACCOUNT" => Some("accountId".to_string()),
        "CONSENSUSCREATETOPIC" => Some("topicId".to_string()),
        "CONTRACTCREATEINSTANCE" => Some("contractId".to_string()),
        "SCHEDULECREATE" => Some("scheduleId".to_string()),
        "FILECREATE" => Some("fileId".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod helper_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn transaction_name_mapping_returns_expected_type() {
        assert_eq!(
            map_transaction_name_to_entity_type(Some("TOKENCREATION")),
            Some("tokenId".to_string())
        );
        assert_eq!(
            map_transaction_name_to_entity_type(Some("contractcreateinstance")),
            Some("contractId".to_string())
        );
        assert_eq!(map_transaction_name_to_entity_type(Some("UNKNOWN")), None);
    }

    #[test]
    fn derive_entity_name_prefers_context_name() {
        let context = json!({ "name": "DemoToken" });
        let derived = derive_entity_name(Some(&context), "tokenId", "0.0.1234");
        assert_eq!(derived, "DemoToken");
    }

    #[test]
    fn derive_entity_name_falls_back_to_entity_id() {
        let derived = derive_entity_name(None, "tokenId", "0.0.9999");
        assert_eq!(derived, "0.0.9999");
    }

    #[test]
    fn extract_entity_from_transaction_handles_token_creation() {
        let transaction = json!({
            "name": "TOKENCREATION",
            "entity_id": "0.0.5678"
        });
        let entity = extract_entity_from_transaction(&transaction).expect("entity");
        assert_eq!(entity.0, "0.0.5678");
        assert_eq!(entity.1, "tokenId");
    }

    #[test]
    fn enrich_transaction_response_populates_data_block() {
        let mut value = json!({ "success": true, "data": {} });
        enrich_transaction_response(
            &mut value,
            "0.0.3333",
            "tokenId",
            "Demo",
            Some("0.0.1111@123"),
        );

        let data = value
            .get("data")
            .and_then(Value::as_object)
            .expect("data object");
        assert_eq!(data.get("entityId").unwrap(), "0.0.3333");
        assert_eq!(data.get("entityType").unwrap(), "tokenId");
        assert_eq!(data.get("entityName").unwrap(), "Demo");
        assert_eq!(data.get("transactionId").unwrap(), "0.0.1111@123");
    }
}

fn escape_csv(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct McpConnectionResponse {
    success: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl From<McpConnectionResult> for McpConnectionResponse {
    fn from(result: McpConnectionResult) -> Self {
        Self {
            success: result.success,
            tools: result.tools,
            error: result.error,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct McpRegistrySearchResponse {
    servers: Vec<Value>,
    total: usize,
    has_more: bool,
    categories: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metric_statuses: Option<HashMap<String, Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metric_freshness: Option<HashMap<String, Value>>,
}

impl From<McpRegistrySearchResult> for McpRegistrySearchResponse {
    fn from(result: McpRegistrySearchResult) -> Self {
        let McpRegistrySearchResult {
            servers,
            total,
            has_more,
            categories,
            metric_statuses,
            metric_freshness,
        } = result;

        Self {
            servers,
            total,
            has_more,
            categories,
            metric_statuses: if metric_statuses.is_empty() {
                None
            } else {
                Some(metric_statuses)
            },
            metric_freshness: if metric_freshness.is_empty() {
                None
            } else {
                Some(metric_freshness)
            },
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpSavePayload {
    servers: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorNodeSchedulePayload {
    schedule_id: String,
    #[serde(default)]
    network: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorNodeTimestampPayload {
    timestamp: String,
    #[serde(default)]
    network: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MirrorNodeTransactionPayload {
    transaction_id: String,
    #[serde(default)]
    network: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WalletSetPayload {
    info: Option<WalletBridgeInfo>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransactionBytesPayload {
    transaction_bytes: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteTransactionPayload {
    #[serde(rename = "transactionBytes")]
    transaction_bytes: String,
    #[serde(default)]
    entity_context: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WalletHydratePayload {
    transaction_id: String,
    #[serde(default)]
    network: Option<String>,
    session_id: String,
    #[serde(default)]
    entity_context: Option<Value>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntityFiltersPayload {
    #[serde(default)]
    search: Option<String>,
    #[serde(default)]
    entity_type: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    date_range: Option<EntityDateRangePayload>,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntityDateRangePayload {
    #[serde(default)]
    start: Option<String>,
    #[serde(default)]
    end: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EntityIdPayload {
    #[serde(rename = "entityId")]
    entity_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntityBulkDeletePayload {
    entity_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntityRenamePayload {
    entity_id: String,
    new_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EntityExportPayload {
    #[serde(default)]
    filters: Option<EntityFiltersPayload>,
    #[serde(default)]
    format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EntitySearchPayload {
    query: String,
    #[serde(default)]
    entity_type: Option<String>,
}

#[tauri::command]
async fn credential_store(
    state: State<'_, Mutex<CredentialManager>>,
    service: String,
    account: String,
    password: String,
) -> Result<CommandResponse<bool>, String> {
    match state
        .lock()
        .await
        .store(&service, &account, &password)
        .await
    {
        Ok(result) => Ok(CommandResponse::ok(result)),
        Err(error) => Ok(CommandResponse::error(error.to_string())),
    }
}

#[tauri::command]
async fn credential_get(
    state: State<'_, Mutex<CredentialManager>>,
    service: String,
    account: String,
) -> Result<CommandResponse<Option<String>>, String> {
    match state.lock().await.get(&service, &account).await {
        Ok(result) => Ok(CommandResponse::ok(result)),
        Err(error) => Ok(CommandResponse::error(error.to_string())),
    }
}

#[tauri::command]
async fn credential_delete(
    state: State<'_, Mutex<CredentialManager>>,
    service: String,
    account: String,
) -> Result<CommandResponse<bool>, String> {
    match state.lock().await.delete(&service, &account).await {
        Ok(result) => Ok(CommandResponse::ok(result)),
        Err(error) => Ok(CommandResponse::error(error.to_string())),
    }
}

#[tauri::command]
async fn credential_clear(
    state: State<'_, Mutex<CredentialManager>>,
    service: Option<String>,
) -> Result<CommandResponse<u32>, String> {
    let resolved_service = service.unwrap_or_else(|| "conversational-agent".to_string());
    match state.lock().await.clear(&resolved_service).await {
        Ok(result) => Ok(CommandResponse::ok(result)),
        Err(error) => Ok(CommandResponse::error(error.to_string())),
    }
}

#[tauri::command]
async fn mirror_node_get_schedule_info(
    state: State<'_, MirrorBridgeState>,
    payload: MirrorNodeSchedulePayload,
) -> Result<CommandResponse<Value>, String> {
    let MirrorNodeSchedulePayload {
        schedule_id,
        network,
    } = payload;

    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Mirror node bridge is not available".to_string(),
            ));
        }
    };

    let network = MirrorNetwork::try_from_str(network.as_deref())?;
    let result = bridge.get_schedule_info(&schedule_id, network).await?;
    Ok(CommandResponse::ok(result.unwrap_or(Value::Null)))
}

#[tauri::command]
async fn mirror_node_get_scheduled_transaction_status(
    state: State<'_, MirrorBridgeState>,
    payload: MirrorNodeSchedulePayload,
) -> Result<CommandResponse<Value>, String> {
    let MirrorNodeSchedulePayload {
        schedule_id,
        network,
    } = payload;

    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Mirror node bridge is not available".to_string(),
            ));
        }
    };

    let network = MirrorNetwork::try_from_str(network.as_deref())?;
    let status = bridge
        .get_scheduled_transaction_status(&schedule_id, network)
        .await?;
    Ok(CommandResponse::ok(status))
}

#[tauri::command]
async fn mirror_node_get_transaction_by_timestamp(
    state: State<'_, MirrorBridgeState>,
    payload: MirrorNodeTimestampPayload,
) -> Result<CommandResponse<Value>, String> {
    let MirrorNodeTimestampPayload { timestamp, network } = payload;

    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Mirror node bridge is not available".to_string(),
            ));
        }
    };

    let network = MirrorNetwork::try_from_str(network.as_deref())?;
    let transactions = bridge
        .get_transaction_by_timestamp(&timestamp, network)
        .await?;
    Ok(CommandResponse::ok(Value::Array(transactions)))
}

#[tauri::command]
async fn mirror_node_get_transaction(
    state: State<'_, MirrorBridgeState>,
    payload: MirrorNodeTransactionPayload,
) -> Result<CommandResponse<Value>, String> {
    let MirrorNodeTransactionPayload {
        transaction_id,
        network,
    } = payload;

    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Mirror node bridge is not available".to_string(),
            ));
        }
    };

    let network = MirrorNetwork::try_from_str(network.as_deref())?;
    let transaction = bridge.get_transaction(&transaction_id, network).await?;
    Ok(CommandResponse::ok(transaction.unwrap_or(Value::Null)))
}

#[tauri::command]
async fn mirror_node_get_token_info(
    state: State<'_, MirrorBridgeState>,
    payload: MirrorNodeTransactionPayload,
) -> Result<CommandResponse<Value>, String> {
    let MirrorNodeTransactionPayload {
        transaction_id,
        network,
    } = payload;

    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Mirror node bridge is not available".to_string(),
            ));
        }
    };

    let network = MirrorNetwork::try_from_str(network.as_deref())?;
    let info = bridge.get_token_info(&transaction_id, network).await?;
    Ok(CommandResponse::ok(info.unwrap_or(Value::Null)))
}

#[tauri::command]
async fn transaction_parser_validate(
    state: State<'_, TransactionParserState>,
    payload: TransactionBytesPayload,
) -> Result<CommandResponse<Value>, String> {
    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Transaction parser bridge is not available".to_string(),
            ));
        }
    };

    let result = bridge.validate(&payload.transaction_bytes).await?;
    Ok(CommandResponse::ok(result))
}

#[tauri::command]
async fn transaction_parser_parse(
    state: State<'_, TransactionParserState>,
    payload: TransactionBytesPayload,
) -> Result<CommandResponse<Value>, String> {
    let bridge = match state.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "Transaction parser bridge is not available".to_string(),
            ));
        }
    };

    let result = bridge.parse(&payload.transaction_bytes).await?;
    Ok(CommandResponse::ok(result))
}

#[tauri::command(rename = "execute-transaction-bytes")]
async fn execute_transaction_bytes(
    app: AppHandle<Wry>,
    wallet_bridge: State<'_, WalletBridgeState>,
    wallet_info: State<'_, Arc<Mutex<Option<WalletBridgeInfo>>>>,
    entity_state: State<'_, Mutex<EntityService>>,
    agent_state: State<'_, Mutex<AgentService>>,
    mirror_state: State<'_, MirrorBridgeState>,
    payload: ExecuteTransactionPayload,
) -> Result<CommandResponse<Value>, String> {
    wallet_bridge.set_app_handle(&app);

    let network = {
        let guard = wallet_info.lock().await;
        match guard.as_ref() {
            Some(info) => info.network.clone(),
            None => {
                return Ok(CommandResponse::error("No wallet connected".to_string()));
            }
        }
    };

    let ExecuteTransactionPayload {
        transaction_bytes,
        entity_context,
    } = payload;

    let network_clone = network.clone();

    match wallet_execute_bytes(wallet_bridge.inner(), transaction_bytes, network).await {
        Ok(mut value) => {
            if value
                .get("success")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                let transaction_id = extract_transaction_id(&value);

                let mut derived_entity = extract_entity_from_response(&value);

                if derived_entity.is_none() {
                    if let Some(ref tx_id) = transaction_id {
                        log::debug!(
                            "execute_transaction_bytes: wallet response missing entity id; polling mirror for transaction {}",
                            tx_id
                        );
                        if let Some(entity) =
                            hydrate_entity_via_mirror(&mirror_state, tx_id, &network_clone).await
                        {
                            derived_entity = Some(entity);
                        }
                    }
                }

                if let Some((entity_id, entity_type)) = derived_entity {
                    let entity_name =
                        derive_entity_name(entity_context.as_ref(), &entity_type, &entity_id);
                    let metadata_value = json!({
                        "entityContext": entity_context.clone().unwrap_or(Value::Null),
                        "source": "executeTransactionBytes",
                        "recordedAt": Utc::now().to_rfc3339(),
                        "transactionId": transaction_id,
                        "network": network_clone,
                    });

                    let _ = persist_entity_association(
                        &app,
                        &entity_state,
                        &agent_state,
                        &entity_id,
                        &entity_type,
                        &entity_name,
                        transaction_id.as_ref(),
                        None,
                        &metadata_value,
                    )
                    .await;

                    enrich_transaction_response(
                        &mut value,
                        &entity_id,
                        &entity_type,
                        &entity_name,
                        transaction_id.as_deref(),
                    );
                } else if let Some(ref tx_id) = transaction_id {
                    log::info!(
                        "execute_transaction_bytes: transaction {} completed without detectable entity metadata",
                        tx_id
                    );
                } else {
                    log::info!(
                        "execute_transaction_bytes: wallet execution completed without transaction id"
                    );
                }
            }

            Ok(CommandResponse::ok(value))
        }
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn wallet_hydrate_entity(
    app: AppHandle<Wry>,
    entity_state: State<'_, Mutex<EntityService>>,
    agent_state: State<'_, Mutex<AgentService>>,
    mirror_state: State<'_, MirrorBridgeState>,
    payload: WalletHydratePayload,
) -> Result<CommandResponse<Value>, String> {
    let network = payload.network.as_deref().unwrap_or("testnet");
    let session_id_trimmed = payload.session_id.trim();
    if session_id_trimmed.is_empty() {
        return Ok(CommandResponse::error(
            "Session ID is required to hydrate entity data".to_string(),
        ));
    }

    log::debug!(
        "wallet_hydrate_entity: hydrating transaction {} on network {}",
        payload.transaction_id,
        network
    );

    match hydrate_entity_via_mirror(&mirror_state, &payload.transaction_id, network).await {
        Some((entity_id, entity_type)) => {
            let entity_name =
                derive_entity_name(payload.entity_context.as_ref(), &entity_type, &entity_id);
            let metadata_value = json!({
                "entityContext": payload.entity_context.unwrap_or(Value::Null),
                "source": "walletHydrateEntity",
                "recordedAt": Utc::now().to_rfc3339(),
                "transactionId": payload.transaction_id,
                "network": network,
                "sessionId": session_id_trimmed,
            });

            let stored = persist_entity_association(
                &app,
                &entity_state,
                &agent_state,
                &entity_id,
                &entity_type,
                &entity_name,
                Some(&payload.transaction_id),
                Some(session_id_trimmed),
                &metadata_value,
            )
            .await;

            match stored {
                Some(entity) => Ok(CommandResponse::ok(json!({ "entity": entity }))),
                None => Ok(CommandResponse::error(
                    "Failed to persist entity association".to_string(),
                )),
            }
        }
        None => {
            log::warn!(
                "wallet_hydrate_entity: mirror did not return entity metadata for {}",
                payload.transaction_id
            );
            Ok(CommandResponse::error(
                "Entity metadata is not available yet".to_string(),
            ))
        }
    }
}

#[tauri::command]
async fn wallet_set_current(
    state: State<'_, Arc<Mutex<Option<WalletBridgeInfo>>>>,
    payload: WalletSetPayload,
) -> Result<CommandResponse<bool>, String> {
    if let Some(ref info) = payload.info {
        match info.network.as_str() {
            "mainnet" | "testnet" => {}
            other => {
                return Ok(CommandResponse::error(format!(
                    "Unsupported wallet network: {other}"
                )));
            }
        }
    }

    let arc = Arc::clone(&*state);
    let mut guard = arc.lock().await;
    *guard = payload.info;
    Ok(CommandResponse::ok(true))
}

#[tauri::command]
async fn wallet_status(
    bridge: State<'_, WalletBridgeState>,
    info: State<'_, Arc<Mutex<Option<WalletBridgeInfo>>>>,
) -> Result<CommandResponse<Value>, String> {
    let snapshot = wallet_status_json(bridge.inner(), &info).await;
    Ok(CommandResponse::ok(snapshot))
}

#[tauri::command]
async fn entity_get_all(
    state: State<'_, Mutex<EntityService>>,
    payload: Option<EntityFiltersPayload>,
) -> Result<CommandResponse<Vec<EntityAssociation>>, String> {
    let filters = payload.unwrap_or_default();

    let mut entities = {
        let service = state.lock().await;
        service
            .list_entities(
                filters.entity_type.clone(),
                filters.session_id.clone(),
                filters.limit,
            )
            .await?
    };

    filter_entities_in_place(
        &mut entities,
        filters.search.as_deref(),
        filters.date_range.as_ref(),
    );

    Ok(CommandResponse::ok(entities))
}

#[tauri::command]
async fn entity_delete(
    app: AppHandle<Wry>,
    state: State<'_, Mutex<EntityService>>,
    payload: EntityIdPayload,
) -> Result<CommandResponse<Value>, String> {
    let deleted = {
        let service = state.lock().await;
        service.deactivate_entity(&payload.entity_id).await?
    };

    if !deleted {
        return Ok(CommandResponse::error(format!(
            "Entity {} not found",
            payload.entity_id
        )));
    }

    if let Err(error) = app.emit("entity_deleted", payload.entity_id.clone()) {
        log::warn!("Failed to emit entity_deleted event: {}", error);
    }

    Ok(CommandResponse::ok(json!({})))
}

#[tauri::command]
async fn entity_bulk_delete(
    app: AppHandle<Wry>,
    state: State<'_, Mutex<EntityService>>,
    payload: EntityBulkDeletePayload,
) -> Result<CommandResponse<Value>, String> {
    if payload.entity_ids.is_empty() {
        return Ok(CommandResponse::error("No entity IDs provided".to_string()));
    }

    let mut successful: Vec<String> = Vec::new();
    let mut failed: Vec<Value> = Vec::new();

    {
        let service = state.lock().await;
        for entity_id in &payload.entity_ids {
            match service.deactivate_entity(entity_id).await {
                Ok(true) => {
                    successful.push(entity_id.clone());
                    if let Err(error) = app.emit("entity_deleted", entity_id.clone()) {
                        log::warn!("Failed to emit entity_deleted event: {}", error);
                    }
                }
                Ok(false) => failed.push(json!({
                    "entityId": entity_id,
                    "error": "Entity not found"
                })),
                Err(error) => failed.push(json!({
                    "entityId": entity_id,
                    "error": error
                })),
            }
        }
    }

    Ok(CommandResponse::ok(json!({
        "successful": successful,
        "failed": failed,
        "totalRequested": payload.entity_ids.len()
    })))
}

#[tauri::command]
async fn entity_rename(
    app: AppHandle<Wry>,
    state: State<'_, Mutex<EntityService>>,
    payload: EntityRenamePayload,
) -> Result<CommandResponse<EntityAssociation>, String> {
    let trimmed = payload.new_name.trim();
    if trimmed.is_empty() {
        return Ok(CommandResponse::error(
            "Entity name cannot be empty".to_string(),
        ));
    }

    let renamed = {
        let service = state.lock().await;
        service.rename_entity(&payload.entity_id, trimmed).await?
    };

    let Some(entity) = renamed else {
        return Ok(CommandResponse::error("Entity not found".to_string()));
    };

    if let Err(error) = app.emit("entity_updated", entity.clone()) {
        log::warn!("Failed to emit entity_updated event: {}", error);
    }

    Ok(CommandResponse::ok(entity))
}

#[tauri::command]
async fn entity_export(
    state: State<'_, Mutex<EntityService>>,
    payload: EntityExportPayload,
) -> Result<CommandResponse<Value>, String> {
    let filters = payload.filters.unwrap_or_default();
    let format = payload.format.unwrap_or_else(|| "json".to_string());

    let mut entities = {
        let service = state.lock().await;
        service
            .list_entities(
                filters.entity_type.clone(),
                filters.session_id.clone(),
                filters.limit.or(Some(10_000)),
            )
            .await?
    };

    filter_entities_in_place(
        &mut entities,
        filters.search.as_deref(),
        filters.date_range.as_ref(),
    );

    let timestamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let (data, filename) = if format.eq_ignore_ascii_case("csv") {
        let headers = [
            "entityId",
            "entityName",
            "entityType",
            "transactionId",
            "sessionId",
            "createdAt",
            "updatedAt",
            "isActive",
            "metadata",
        ];

        let mut lines = Vec::with_capacity(entities.len() + 1);
        lines.push(headers.join(","));

        for entity in &entities {
            let metadata = entity
                .metadata
                .as_ref()
                .map(|value| value.to_string())
                .unwrap_or_default();

            let row = [
                entity.entity_id.as_str(),
                entity.entity_name.as_str(),
                entity.entity_type.as_str(),
                entity.transaction_id.as_deref().unwrap_or(""),
                entity.session_id.as_deref().unwrap_or(""),
                entity.created_at.as_str(),
                entity.updated_at.as_str(),
                if entity.is_active { "true" } else { "false" },
                metadata.as_str(),
            ];

            let escaped = row
                .iter()
                .map(|value| escape_csv(value))
                .collect::<Vec<_>>()
                .join(",");
            lines.push(escaped);
        }

        (
            lines.join("\n"),
            format!("entities-export-{}.csv", timestamp),
        )
    } else {
        let json_data = serde_json::to_string_pretty(&entities).map_err(|err| err.to_string())?;
        (json_data, format!("entities-export-{}.json", timestamp))
    };

    Ok(CommandResponse::ok(json!({
        "data": data,
        "filename": filename,
        "count": entities.len()
    })))
}

#[tauri::command]
async fn entity_get_by_id(
    state: State<'_, Mutex<EntityService>>,
    payload: EntityIdPayload,
) -> Result<CommandResponse<EntityAssociation>, String> {
    let entity = {
        let service = state.lock().await;
        service.get_entity(&payload.entity_id).await?
    };

    match entity {
        Some(current) => Ok(CommandResponse::ok(current)),
        None => Ok(CommandResponse::error("Entity not found".to_string())),
    }
}

#[tauri::command]
async fn entity_search(
    state: State<'_, Mutex<EntityService>>,
    payload: EntitySearchPayload,
) -> Result<CommandResponse<Vec<EntityAssociation>>, String> {
    let EntitySearchPayload { query, entity_type } = payload;
    let trimmed = query.trim().to_string();

    if trimmed.is_empty() {
        return Ok(CommandResponse::error(
            "Search query is required".to_string(),
        ));
    }

    let results = {
        let service = state.lock().await;
        service
            .search_entities(&trimmed, entity_type.as_deref(), 50)
            .await?
    };

    Ok(CommandResponse::ok(results))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HederaCredentialsPayload {
    account_id: String,
    private_key: String,
    network: String,
}

impl TryFrom<HederaCredentialsPayload> for HederaCredentials {
    type Error = String;

    fn try_from(value: HederaCredentialsPayload) -> Result<Self, Self::Error> {
        let network = match value.network.to_lowercase().as_str() {
            "mainnet" => HederaNetwork::Mainnet,
            "testnet" => HederaNetwork::Testnet,
            _ => return Err("Unsupported Hedera network".to_string()),
        };

        Ok(Self {
            account_id: value.account_id,
            private_key: value.private_key,
            network,
        })
    }
}

#[derive(Deserialize)]
struct LlmCredentialsPayload {
    api_key: String,
    model: String,
}

impl From<LlmCredentialsPayload> for LlmCredentials {
    fn from(value: LlmCredentialsPayload) -> Self {
        Self {
            api_key: value.api_key,
            model: value.model,
        }
    }
}

#[tauri::command]
async fn connection_test_hedera(
    state: State<'_, Mutex<ConnectionService>>,
    credentials: HederaCredentialsPayload,
) -> Result<HederaTestResponse, String> {
    let converted = HederaCredentials::try_from(credentials)?;
    state
        .lock()
        .await
        .test_hedera(converted)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn connection_test_openai(
    state: State<'_, Mutex<ConnectionService>>,
    credentials: LlmCredentialsPayload,
) -> Result<LlmTestResponse, String> {
    state
        .lock()
        .await
        .test_openai(credentials.into())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn connection_test_anthropic(
    state: State<'_, Mutex<ConnectionService>>,
    credentials: LlmCredentialsPayload,
) -> Result<LlmTestResponse, String> {
    state
        .lock()
        .await
        .test_anthropic(credentials.into())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn agent_initialize(
    app: AppHandle<Wry>,
    state: State<'_, Mutex<AgentService>>,
    mcp_state: State<'_, Mutex<McpService>>,
    wallet_bridge: State<'_, WalletBridgeState>,
    wallet_info: State<'_, Arc<Mutex<Option<WalletBridgeInfo>>>>,
    mut config: AgentInitializeConfig,
) -> Result<AgentInitializeResponse, String> {
    if config.mcp_servers.is_none() {
        if let Ok(servers) = mcp_state.lock().await.load().await {
            config.mcp_servers = Some(Value::Array(servers));
        }
    }
    wallet_bridge.set_app_handle(&app);
    let bridge_clone = wallet_bridge.inner().clone();
    let wallet_info_arc = Arc::clone(&*wallet_info);
    let wallet_account_log = wallet_info_arc
        .lock()
        .await
        .as_ref()
        .map(|info| info.account_id.clone())
        .unwrap_or_else(|| "<none>".to_string());
    log::info!(
        "agent_initialize payload: account={} user_account={} op_mode={} private_key_present={} wallet_active={}",
        config.account_id,
        config
            .user_account_id
            .clone()
            .unwrap_or_else(|| "<none>".to_string()),
        config
            .operational_mode
            .clone()
            .unwrap_or_else(|| "<unspecified>".to_string()),
        !config.private_key.trim().is_empty(),
        wallet_account_log
    );
    state
        .lock()
        .await
        .initialize(config, bridge_clone, wallet_info_arc)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn agent_status(
    state: State<'_, Mutex<AgentService>>,
) -> Result<CommandResponse<AgentStatusResponse>, String> {
    Ok(CommandResponse::ok(state.lock().await.status().await))
}

#[tauri::command]
async fn agent_disconnect(
    state: State<'_, Mutex<AgentService>>,
) -> Result<CommandResponse<()>, String> {
    state.lock().await.disconnect().await;
    Ok(CommandResponse::ok(()))
}

#[tauri::command]
async fn agent_send_message(
    state: State<'_, Mutex<AgentService>>,
    session_state: State<'_, Mutex<SessionService>>,
    request: AgentMessageRequest,
) -> Result<AgentMessageResponse, String> {
    let session_id_hint = request.session_id.clone();
    let agent = state.lock().await;
    let resolved_session_id = match session_id_hint {
        Some(id) => id,
        None => agent
            .status()
            .await
            .session_id
            .ok_or_else(|| "Agent session is not initialized".to_string())?,
    };

    ensure_session_exists(&session_state, &resolved_session_id).await?;

    let session_guard = session_state.lock().await;
    let response = agent
        .send_message(
            &session_guard,
            AgentMessageRequest {
                session_id: Some(resolved_session_id),
                ..request
            },
        )
        .await
        .map_err(|error| error.to_string())?;

    Ok(response)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSessionPayload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    mode: Option<String>,
    #[serde(default)]
    topic_id: Option<String>,
    #[serde(default = "default_is_active")]
    is_active: bool,
}

fn default_is_active() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionIdPayload {
    session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveSessionPayload {
    session: ChatSession,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveMessagePayload {
    session_id: String,
    message: ChatMessage,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionContextPayload {
    session_id: String,
    mode: String,
    topic_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormStatePayload {
    session_id: String,
    form_id: String,
    completion_state: String,
    completion_data: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MessageMetadataPayload {
    session_id: String,
    message_id: String,
    metadata: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hcs10RegisterPayload {
    #[serde(rename = "profileData")]
    profile_data: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hcs10ProfileNamePayload {
    #[serde(rename = "profileName")]
    profile_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hcs10ValidatePayload {
    #[serde(rename = "profileData")]
    profile_data: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Hcs10RetrievePayload {
    #[serde(rename = "accountId")]
    account_id: String,
}

#[tauri::command]
async fn chat_create_session(
    state: State<'_, Mutex<SessionService>>,
    payload: Option<CreateSessionPayload>,
) -> Result<CommandResponse<ChatSession>, String> {
    let request = payload.unwrap_or(CreateSessionPayload {
        name: None,
        mode: None,
        topic_id: None,
        is_active: default_is_active(),
    });

    let CreateSessionPayload {
        name,
        mode,
        topic_id,
        is_active,
    } = request;

    let resolved_name = name.unwrap_or_else(|| "Untitled Session".to_string());
    let resolved_mode = mode.unwrap_or_else(|| "personal".to_string());

    let session = state
        .lock()
        .await
        .create_session(CreateSessionInput {
            name: resolved_name,
            mode: resolved_mode,
            topic_id,
            is_active,
        })
        .await;
    Ok(CommandResponse::ok(session))
}

#[tauri::command]
async fn chat_load_session(
    state: State<'_, Mutex<SessionService>>,
    payload: SessionIdPayload,
) -> Result<CommandResponse<ChatSession>, String> {
    let service = state.lock().await;
    match service.load_session(&payload.session_id).await {
        Some(session) => Ok(CommandResponse::ok(session)),
        None => Ok(CommandResponse::error("Session not found".to_string())),
    }
}

#[tauri::command]
async fn chat_save_session(
    state: State<'_, Mutex<SessionService>>,
    payload: SaveSessionPayload,
) -> Result<CommandResponse<ChatSession>, String> {
    let session = payload.session;
    state
        .lock()
        .await
        .save_session(session.clone())
        .await
        .map_err(|error| error.to_string())?;
    Ok(CommandResponse::ok(session))
}

#[tauri::command]
async fn chat_delete_session(
    state: State<'_, Mutex<SessionService>>,
    payload: SessionIdPayload,
) -> Result<CommandResponse<bool>, String> {
    let removed = state.lock().await.delete_session(&payload.session_id).await;
    Ok(CommandResponse::ok(removed))
}

#[tauri::command]
async fn chat_load_all_sessions(
    state: State<'_, Mutex<SessionService>>,
) -> Result<CommandResponse<Vec<ChatSession>>, String> {
    let sessions = state.lock().await.load_all_sessions().await;
    Ok(CommandResponse::ok(sessions))
}

#[tauri::command]
async fn chat_save_message(
    state: State<'_, Mutex<SessionService>>,
    payload: SaveMessagePayload,
) -> Result<CommandResponse<ChatMessage>, String> {
    state
        .lock()
        .await
        .save_message(&payload.session_id, payload.message.clone())
        .await
        .map_err(|error| error.to_string())?;
    Ok(CommandResponse::ok(payload.message))
}

#[tauri::command]
async fn chat_load_session_messages(
    state: State<'_, Mutex<SessionService>>,
    payload: SessionIdPayload,
) -> Result<CommandResponse<Vec<ChatMessage>>, String> {
    let messages = state
        .lock()
        .await
        .load_messages(&payload.session_id)
        .await
        .unwrap_or_default();
    Ok(CommandResponse::ok(messages))
}

#[tauri::command]
async fn agent_update_session_context(
    agent_state: State<'_, Mutex<AgentService>>,
    session_state: State<'_, Mutex<SessionService>>,
    payload: SessionContextPayload,
) -> Result<CommandResponse<()>, String> {
    let context = AgentSessionContext {
        session_id: payload.session_id.clone(),
        mode: payload.mode.clone(),
        topic_id: payload.topic_id.clone(),
    };
    agent_state
        .lock()
        .await
        .update_session_context(context)
        .await;
    session_state
        .lock()
        .await
        .update_session_context(SessionContext {
            session_id: payload.session_id,
            mode: payload.mode,
            topic_id: payload.topic_id,
        })
        .await;
    Ok(CommandResponse::ok(()))
}

#[tauri::command]
async fn chat_update_session_context(
    state: State<'_, Mutex<SessionService>>,
    payload: SessionContextPayload,
) -> Result<CommandResponse<()>, String> {
    state
        .lock()
        .await
        .update_session_context(SessionContext {
            session_id: payload.session_id,
            mode: payload.mode,
            topic_id: payload.topic_id,
        })
        .await;
    Ok(CommandResponse::ok(()))
}

#[tauri::command]
async fn chat_update_form_state(
    state: State<'_, Mutex<SessionService>>,
    payload: FormStatePayload,
) -> Result<CommandResponse<Option<ChatMessage>>, String> {
    let result = state
        .lock()
        .await
        .update_form_state(
            &payload.session_id,
            &payload.form_id,
            payload.completion_state,
            payload.completion_data,
        )
        .await?;
    Ok(CommandResponse::ok(result))
}

#[tauri::command]
async fn chat_update_message_metadata(
    state: State<'_, Mutex<SessionService>>,
    payload: MessageMetadataPayload,
) -> Result<CommandResponse<Option<ChatMessage>>, String> {
    let updated = state
        .lock()
        .await
        .update_message_metadata(&payload.session_id, &payload.message_id, payload.metadata)
        .await?;
    Ok(CommandResponse::ok(updated))
}

#[tauri::command]
async fn browser_attach(app: AppHandle<Wry>) -> Result<(), String> {
    log::info!("browser_attach invoked");
    append_browser_log(&app, "browser_attach invoked");
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.attach(&handle).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_attach error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_detach(app: AppHandle<Wry>) -> Result<(), String> {
    append_browser_log(&app, "browser_detach invoked");
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.detach(&handle).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_detach error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_navigate(app: AppHandle<Wry>, url: String) -> Result<(), String> {
    append_browser_log(&app, &format!("browser_navigate: {url}"));
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.navigate(&handle, url).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_navigate error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_reload(app: AppHandle<Wry>) -> Result<(), String> {
    append_browser_log(&app, "browser_reload invoked");
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.reload(&handle).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_reload error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_go_back(app: AppHandle<Wry>) -> Result<(), String> {
    append_browser_log(&app, "browser_go_back invoked");
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.go_back(&handle).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_go_back error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_go_forward(app: AppHandle<Wry>) -> Result<(), String> {
    append_browser_log(&app, "browser_go_forward invoked");
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.go_forward(&handle).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_go_forward error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_set_bounds(
    app: AppHandle<Wry>,
    bounds: browser::BoundsPayload,
) -> Result<(), String> {
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.set_bounds(&handle, bounds).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_set_bounds error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_set_layout(
    app: AppHandle<Wry>,
    layout: browser::LayoutPayload,
) -> Result<(), String> {
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.set_layout(&handle, layout).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_set_layout error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_capture_context(app: AppHandle<Wry>) -> Result<Option<Value>, String> {
    with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.capture_context(&handle).await
    })
    .await
}

#[tauri::command]
async fn browser_get_state(app: AppHandle<Wry>) -> Result<BrowserStateDto, String> {
    with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.get_state().await
    })
    .await
}

#[tauri::command]
async fn browser_execute_js(app: AppHandle<Wry>, script: String) -> Result<Value, String> {
    let result = with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.execute_js(&handle, script).await
    })
    .await;
    if let Err(error) = &result {
        append_browser_log(&app, &format!("browser_execute_js error: {error}"));
    }
    result
}

#[tauri::command]
async fn browser_open_devtools(app: AppHandle<Wry>) -> Result<(), String> {
    with_browser_manager_async(app.clone(), |handle| async move {
        let manager = handle.state::<ActiveBrowserManager>();
        manager.open_devtools(&handle).await
    })
    .await
}

#[tauri::command]
fn browser_open_external(url: String) -> Result<(), String> {
    open::that(url).map_err(|error| error.to_string())
}

fn with_browser_manager<F, R>(app: &AppHandle<Wry>, f: F) -> Result<R, String>
where
    F: FnOnce(&ActiveBrowserManager) -> Result<R, String>,
{
    let state = app
        .try_state::<ActiveBrowserManager>()
        .ok_or_else(|| "Browser manager unavailable".to_string())?;
    f(&*state)
}

async fn with_browser_manager_async<F, Fut, R>(app: AppHandle<Wry>, f: F) -> Result<R, String>
where
    F: FnOnce(AppHandle<Wry>) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<R, String>> + Send + 'static,
    R: Send + 'static,
{
    let _ = app
        .try_state::<ActiveBrowserManager>()
        .ok_or_else(|| "Browser manager unavailable".to_string())?;
    f(app).await
}

fn append_browser_log(app: &AppHandle<Wry>, message: &str) {
    if let Ok(config_dir) = app.path().app_data_dir() {
        if let Err(err) = std::fs::create_dir_all(&config_dir) {
            log::warn!("Failed to create browser log directory: {err}");
            return;
        }
        let log_path = config_dir.join("browser.log");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let _ = writeln!(file, "[{timestamp}] {message}");
            log::info!("[browser_log] {} => {}", timestamp, message);
            log::info!("[browser_log] path: {}", log_path.display());
        }
    }
}

#[tauri::command]
async fn mcp_load_servers(
    state: State<'_, Mutex<McpService>>,
) -> Result<CommandResponse<Vec<Value>>, String> {
    log::debug!("mcp_load_servers invoked");
    let service = state.lock().await;
    let result = service.load().await;
    match result {
        Ok(servers) => Ok(CommandResponse::ok(servers)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_save_servers(
    state: State<'_, Mutex<McpService>>,
    payload: McpSavePayload,
) -> Result<CommandResponse<bool>, String> {
    let servers = payload.servers;
    let service = state.lock().await;
    let result = service.save(servers).await;
    match result {
        Ok(()) => Ok(CommandResponse::ok(true)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_test_connection(
    state: State<'_, Mutex<McpService>>,
    server: Value,
) -> Result<CommandResponse<McpConnectionResponse>, String> {
    let service = state.lock().await;
    let result = service.test_connection(&server).await;
    match result {
        Ok(result) => Ok(CommandResponse::ok(result.into())),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_connect_server(
    state: State<'_, Mutex<McpService>>,
    server_id: String,
) -> Result<CommandResponse<McpConnectionResponse>, String> {
    let service = state.lock().await;
    let result = service.connect(&server_id).await;
    match result {
        Ok(result) => Ok(CommandResponse::ok(result.into())),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_disconnect_server(
    state: State<'_, Mutex<McpService>>,
    server_id: String,
) -> Result<CommandResponse<bool>, String> {
    let service = state.lock().await;
    let result = service.disconnect(&server_id).await;
    match result {
        Ok(disconnected) => Ok(CommandResponse::ok(disconnected)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_get_server_tools(
    state: State<'_, Mutex<McpService>>,
    server_id: String,
) -> Result<CommandResponse<Vec<Value>>, String> {
    let service = state.lock().await;
    let result = service.connected_tools(&server_id).await;
    match result {
        Ok(tools) => Ok(CommandResponse::ok(tools)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_refresh_server_tools(
    state: State<'_, Mutex<McpService>>,
    server_id: String,
) -> Result<CommandResponse<McpConnectionResponse>, String> {
    let service = state.lock().await;
    let result = service.refresh_tools(&server_id).await;
    match result {
        Ok(result) => Ok(CommandResponse::ok(result.into())),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_search_registry(
    state: State<'_, Mutex<McpService>>,
    options: Value,
) -> Result<CommandResponse<McpRegistrySearchResponse>, String> {
    let service = state.lock().await;
    let result = service.search_registry(&options).await;
    match result {
        Ok(result) => Ok(CommandResponse::ok(result.into())),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_get_registry_server_details(
    state: State<'_, Mutex<McpService>>,
    server_id: String,
    package_name: Option<String>,
) -> Result<CommandResponse<Value>, String> {
    let service = state.lock().await;
    let result = service
        .registry_server_details(&server_id, package_name)
        .await;
    match result {
        Ok(details) => Ok(CommandResponse::ok(details)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpInstallPayload {
    server_id: String,
    package_name: Option<String>,
    install_command: Option<Value>,
}

#[tauri::command]
async fn mcp_install_from_registry(
    state: State<'_, Mutex<McpService>>,
    payload: McpInstallPayload,
) -> Result<CommandResponse<Value>, String> {
    let server_id = payload.server_id;
    let package_name = payload.package_name;
    let install_command = payload.install_command;
    let service = state.lock().await;
    let result = service
        .install_from_registry(&server_id, package_name, install_command)
        .await;
    match result {
        Ok(server) => Ok(CommandResponse::ok(server)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_clear_registry_cache(
    state: State<'_, Mutex<McpService>>,
) -> Result<CommandResponse<bool>, String> {
    let service = state.lock().await;
    let result = service.clear_registry_cache().await;
    match result {
        Ok(()) => Ok(CommandResponse::ok(true)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_get_cache_stats(
    state: State<'_, Mutex<McpService>>,
) -> Result<CommandResponse<Value>, String> {
    let service = state.lock().await;
    let result = service.cache_stats().await;
    drop(service);
    match result {
        Ok(mut stats) => {
            let should_refresh = stats
                .get("lastBackgroundSync")
                .and_then(Value::as_str)
                .and_then(|iso| DateTime::parse_from_rfc3339(iso).ok())
                .map(|dt| Utc::now() - dt.with_timezone(&Utc) > Duration::hours(6))
                .unwrap_or(true);

            if should_refresh {
                let service = state.lock().await;
                let refresh_result = service.trigger_background_sync().await;
                drop(service);
                if let Ok(new_stats) = refresh_result {
                    stats = new_stats;
                }
            }

            Ok(CommandResponse::ok(stats))
        }
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_trigger_background_sync(
    state: State<'_, Mutex<McpService>>,
) -> Result<CommandResponse<Value>, String> {
    let service = state.lock().await;
    let result = service.trigger_background_sync().await;
    match result {
        Ok(stats) => Ok(CommandResponse::ok(stats)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn mcp_enrich_metrics(
    state: State<'_, Mutex<McpService>>,
    options: Value,
) -> Result<CommandResponse<bool>, String> {
    let service = state.lock().await;
    let result = service.enrich_metrics(&options).await;
    match result {
        Ok(()) => Ok(CommandResponse::ok(true)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn hcs10_register_profile(
    app: AppHandle<Wry>,
    service: State<'_, Hcs10Service>,
    config_state: State<'_, ConfigState>,
    payload: Hcs10RegisterPayload,
) -> Result<CommandResponse<Value>, String> {
    let result = service
        .register_profile(&app, &config_state, payload.profile_data)
        .await;

    match result {
        Ok(value) => Ok(CommandResponse::ok(value)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

#[tauri::command]
async fn hcs10_validate_profile(
    service: State<'_, Hcs10Service>,
    payload: Hcs10ValidatePayload,
) -> Result<CommandResponse<Value>, String> {
    if let Some(bridge) = service.bridge() {
        let request = json!({ "profileData": payload.profile_data });
        match bridge.validate_profile(request).await {
            Ok(value) => Ok(CommandResponse::ok(value)),
            Err(error) => Ok(CommandResponse::error(error)),
        }
    } else {
        Ok(CommandResponse::error(
            "HCS10 bridge not available".to_string(),
        ))
    }
}

#[tauri::command]
async fn hcs10_get_profiles(
    app: AppHandle<Wry>,
    state: State<'_, ConfigState>,
) -> Result<CommandResponse<Vec<StoredHcs10Profile>>, String> {
    let response = load_config(app, state)?;
    Ok(CommandResponse::ok(response.config.hcs10_profiles))
}

#[tauri::command]
async fn hcs10_get_registration_progress(
    service: State<'_, Hcs10Service>,
    payload: Hcs10ProfileNamePayload,
) -> Result<CommandResponse<Option<Value>>, String> {
    let progress = service.get_registration_progress(&payload.profile_name)?;
    Ok(CommandResponse::ok(progress))
}

#[tauri::command]
async fn hcs10_is_registration_in_progress(
    service: State<'_, Hcs10Service>,
    payload: Hcs10ProfileNamePayload,
) -> Result<CommandResponse<bool>, String> {
    let in_progress = service
        .is_registration_in_progress(&payload.profile_name)
        .await?;
    Ok(CommandResponse::ok(in_progress))
}

#[tauri::command]
async fn hcs10_cancel_registration(
    service: State<'_, Hcs10Service>,
) -> Result<CommandResponse<()>, String> {
    service.cancel_registration(service.bridge()).await?;
    Ok(CommandResponse::ok(()))
}

#[tauri::command]
async fn hcs10_clear_all_states(
    service: State<'_, Hcs10Service>,
) -> Result<CommandResponse<()>, String> {
    service.clear_all_states()?;
    Ok(CommandResponse::ok(()))
}

#[tauri::command]
async fn hcs10_retrieve_profile(
    app: AppHandle<Wry>,
    service: State<'_, Hcs10Service>,
    config_state: State<'_, ConfigState>,
    payload: Hcs10RetrievePayload,
) -> Result<CommandResponse<Value>, String> {
    let bridge = match service.bridge() {
        Some(bridge) => bridge,
        None => {
            return Ok(CommandResponse::error(
                "HCS10 bridge not available".to_string(),
            ));
        }
    };

    let LoadConfigResponse { config, .. } = load_config(app.clone(), config_state.clone())?;

    if config.hedera.account_id.trim().is_empty() || config.hedera.private_key.trim().is_empty() {
        return Ok(CommandResponse::error(
            "Missing Hedera credentials. Please configure your Hedera account.".to_string(),
        ));
    }

    let request = json!({
        "accountId": payload.account_id,
        "hedera": {
            "accountId": config.hedera.account_id,
            "privateKey": config.hedera.private_key,
            "network": match config.hedera.network {
                Network::Mainnet => "mainnet",
                Network::Testnet => "testnet",
            }
        }
    });

    match bridge.retrieve_profile(request).await {
        Ok(value) => Ok(CommandResponse::ok(value)),
        Err(error) => Ok(CommandResponse::error(error)),
    }
}

fn resolve_bridge_script(app: &AppHandle<Wry>) -> Option<PathBuf> {
    if let Ok(override_path) = std::env::var("AGENT_BRIDGE_PATH") {
        let candidate = PathBuf::from(override_path);
        if candidate.exists() {
            log::debug!("Bridge override resolved: {}", candidate.display());
            return Some(candidate);
        }
        log::warn!(
            "AGENT_BRIDGE_PATH set but file not found: {}",
            candidate.display()
        );
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(mut resource_dir) = app.path().resource_dir() {
        resource_dir.push("agent-bridge.js");
        candidates.push(resource_dir);
    }
    if let Ok(resolved) = app
        .path()
        .resolve("agent-bridge.js", BaseDirectory::Resource)
    {
        candidates.push(resolved);
    }

    candidates.push(manifest_dir.join("resources").join("agent-bridge.js"));

    if let Some(parent) = manifest_dir.parent() {
        candidates.push(
            parent
                .join("src-tauri")
                .join("resources")
                .join("agent-bridge.js"),
        );
        candidates.push(
            parent
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("agent-bridge.js"),
        );
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("resources")
                .join("agent-bridge.js"),
        );
        candidates.push(
            current_dir
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("agent-bridge.js"),
        );
        if let Some(parent) = current_dir.parent() {
            candidates.push(
                parent
                    .join("src-tauri")
                    .join("resources")
                    .join("agent-bridge.js"),
            );
            candidates.push(
                parent
                    .join("desktop-tauri")
                    .join("src-tauri")
                    .join("resources")
                    .join("agent-bridge.js"),
            );
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
        log::debug!("Bridge candidate missing: {}", candidate.display());
    }

    None
}

fn resolve_mirror_bridge_script(app: &AppHandle<Wry>) -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(mut resource_dir) = app.path().resource_dir() {
        resource_dir.push("mirror-node-bridge.js");
        candidates.push(resource_dir);
    }

    if let Ok(resolved) = app
        .path()
        .resolve("mirror-node-bridge.js", BaseDirectory::Resource)
    {
        candidates.push(resolved);
    }

    candidates.push(manifest_dir.join("resources").join("mirror-node-bridge.js"));

    if let Some(parent) = manifest_dir.parent() {
        candidates.push(
            parent
                .join("src-tauri")
                .join("resources")
                .join("mirror-node-bridge.js"),
        );
        candidates.push(
            parent
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("mirror-node-bridge.js"),
        );
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("resources")
                .join("mirror-node-bridge.js"),
        );
        candidates.push(
            current_dir
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("mirror-node-bridge.js"),
        );
        if let Some(parent) = current_dir.parent() {
            candidates.push(
                parent
                    .join("src-tauri")
                    .join("resources")
                    .join("mirror-node-bridge.js"),
            );
            candidates.push(
                parent
                    .join("desktop-tauri")
                    .join("src-tauri")
                    .join("resources")
                    .join("mirror-node-bridge.js"),
            );
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            log::debug!(
                "Resolved mirror node bridge script: {}",
                candidate.display()
            );
            return Some(candidate);
        }
    }

    log::warn!("Unable to locate mirror-node-bridge.js; mirror node commands will be disabled");
    None
}

fn resolve_transaction_parser_script(app: &AppHandle<Wry>) -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(mut resource_dir) = app.path().resource_dir() {
        resource_dir.push("transaction-parser-bridge.js");
        candidates.push(resource_dir);
    }

    if let Ok(resolved) = app
        .path()
        .resolve("transaction-parser-bridge.js", BaseDirectory::Resource)
    {
        candidates.push(resolved);
    }

    candidates.push(
        manifest_dir
            .join("resources")
            .join("transaction-parser-bridge.js"),
    );

    if let Some(parent) = manifest_dir.parent() {
        candidates.push(
            parent
                .join("src-tauri")
                .join("resources")
                .join("transaction-parser-bridge.js"),
        );
        candidates.push(
            parent
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("transaction-parser-bridge.js"),
        );
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("resources")
                .join("transaction-parser-bridge.js"),
        );
        candidates.push(
            current_dir
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("transaction-parser-bridge.js"),
        );
        if let Some(parent) = current_dir.parent() {
            candidates.push(
                parent
                    .join("src-tauri")
                    .join("resources")
                    .join("transaction-parser-bridge.js"),
            );
            candidates.push(
                parent
                    .join("desktop-tauri")
                    .join("src-tauri")
                    .join("resources")
                    .join("transaction-parser-bridge.js"),
            );
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            log::debug!(
                "Resolved transaction parser bridge script: {}",
                candidate.display()
            );
            return Some(candidate);
        }
    }

    log::warn!(
        "Unable to locate transaction-parser-bridge.js; transaction parser commands will be disabled"
    );
    None
}

fn resolve_hcs10_bridge_script(app: &AppHandle<Wry>) -> Option<PathBuf> {
    if let Ok(override_path) = std::env::var("HCS10_BRIDGE_PATH") {
        let candidate = PathBuf::from(override_path);
        if candidate.exists() {
            log::debug!("HCS10 bridge override resolved: {}", candidate.display());
            return Some(candidate);
        }
        log::warn!(
            "HCS10_BRIDGE_PATH set but file not found: {}",
            candidate.display()
        );
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(mut resource_dir) = app.path().resource_dir() {
        resource_dir.push("hcs10-bridge.js");
        candidates.push(resource_dir);
    }
    if let Ok(resolved) = app
        .path()
        .resolve("hcs10-bridge.js", BaseDirectory::Resource)
    {
        candidates.push(resolved);
    }

    candidates.push(manifest_dir.join("resources").join("hcs10-bridge.js"));

    if let Some(parent) = manifest_dir.parent() {
        candidates.push(
            parent
                .join("src-tauri")
                .join("resources")
                .join("hcs10-bridge.js"),
        );
        candidates.push(
            parent
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("hcs10-bridge.js"),
        );
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join("src-tauri")
                .join("resources")
                .join("hcs10-bridge.js"),
        );
        candidates.push(
            current_dir
                .join("desktop-tauri")
                .join("src-tauri")
                .join("resources")
                .join("hcs10-bridge.js"),
        );
        if let Some(parent) = current_dir.parent() {
            candidates.push(
                parent
                    .join("src-tauri")
                    .join("resources")
                    .join("hcs10-bridge.js"),
            );
            candidates.push(
                parent
                    .join("desktop-tauri")
                    .join("src-tauri")
                    .join("resources")
                    .join("hcs10-bridge.js"),
            );
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            log::debug!("Resolved HCS10 bridge script: {}", candidate.display());
            return Some(candidate);
        }
    }

    None
}

async fn ensure_session_exists(
    session_state: &State<'_, Mutex<SessionService>>,
    session_id: &str,
) -> Result<(), String> {
    if session_state
        .lock()
        .await
        .load_session(session_id)
        .await
        .is_none()
    {
        let now = Utc::now().to_rfc3339();
        let session = ChatSession {
            id: session_id.to_string(),
            name: "Untitled Session".to_string(),
            mode: "personal".to_string(),
            topic_id: None,
            created_at: now.clone(),
            updated_at: now.clone(),
            last_message_at: None,
            is_active: true,
            messages: Vec::new(),
        };
        session_state.lock().await.save_session(session).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::normalize_transaction_id_for_mirror;

    #[test]
    fn normalizes_at_delimited_transaction_id() {
        let original = "0.0.1234@1700000000.123456789";
        let normalized = normalize_transaction_id_for_mirror(original);
        assert_eq!(normalized.as_ref(), "0.0.1234-1700000000-123456789");
    }

    #[test]
    fn leaves_hyphenated_transaction_id_unchanged() {
        let original = "0.0.1234-1700000000-123456789";
        let normalized = normalize_transaction_id_for_mirror(original);
        assert_eq!(normalized.as_ref(), original);
    }

    #[test]
    fn handles_missing_nanoseconds_segment() {
        let original = "0.0.1234@1700000000";
        let normalized = normalize_transaction_id_for_mirror(original);
        assert_eq!(normalized.as_ref(), "0.0.1234-1700000000");
    }
}
