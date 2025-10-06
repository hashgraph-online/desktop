use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config::{
    ConfigState, LoadConfigResponse, Network, OperationalMode, ProfileSocials, ProfileStatus,
    StoredHcs10Profile, load_config, save_config,
};
use tauri::Emitter;

const EVENT_REGISTRATION_PROGRESS: &str = "hcs10_registration_progress";
const REGISTRATION_TIMEOUT: Duration = Duration::from_secs(600);
const STATE_EXPIRY_HOURS: i64 = 24;

#[derive(Serialize)]
struct BridgeRequest {
    id: u64,
    action: String,
    payload: Value,
}

#[derive(Deserialize, Debug)]
struct BridgeEnvelope {
    id: Option<u64>,
    #[serde(rename = "type")]
    message_type: Option<String>,
    success: bool,
    #[serde(default)]
    data: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

struct Hcs10Process {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

#[derive(Clone)]
pub struct Hcs10Bridge {
    process: Arc<Mutex<Hcs10Process>>,
}

impl Hcs10Bridge {
    pub async fn spawn(script_path: PathBuf) -> Result<Self, String> {
        let mut command = Command::new("node");
        command
            .arg(&script_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit());

        if let Some(parent) = script_path.parent() {
            command.current_dir(parent);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn HCS10 bridge: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "HCS10 bridge stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "HCS10 bridge stdout unavailable".to_string())?;

        Ok(Self {
            process: Arc::new(Mutex::new(Hcs10Process {
                child,
                stdin,
                stdout: BufReader::new(stdout),
                next_id: 0,
            })),
        })
    }

    async fn send_request<F>(
        &self,
        action: &str,
        payload: Value,
        mut on_progress: F,
    ) -> Result<Value, String>
    where
        F: FnMut(&Value) -> Result<(), String> + Send,
    {
        let mut guard = self.process.lock().await;
        guard.next_id = guard.next_id.wrapping_add(1);
        let request_id = guard.next_id;
        let request = BridgeRequest {
            id: request_id,
            action: action.to_string(),
            payload,
        };

        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize HCS10 request: {error}"))?
            + "\n";

        guard
            .stdin
            .write_all(serialized.as_bytes())
            .await
            .map_err(|error| format!("Failed to write to HCS10 bridge: {error}"))?;
        guard
            .stdin
            .flush()
            .await
            .map_err(|error| format!("Failed to flush HCS10 bridge: {error}"))?;

        let mut response_line = String::new();

        loop {
            response_line.clear();
            let read_result = tokio::time::timeout(
                REGISTRATION_TIMEOUT,
                guard.stdout.read_line(&mut response_line),
            )
            .await
            .map_err(|_| "HCS10 bridge timed out while waiting for response".to_string())?
            .map_err(|error| format!("Failed to read HCS10 bridge response: {error}"))?;

            if read_result == 0 {
                return Err("HCS10 bridge closed the stream unexpectedly".to_string());
            }

            let trimmed = response_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if !trimmed.starts_with('{') {
                log::debug!("Skipping non-JSON output from HCS10 bridge: {}", trimmed);
                continue;
            }

            let envelope: BridgeEnvelope = match serde_json::from_str(trimmed) {
                Ok(value) => value,
                Err(error) => {
                    log::debug!(
                        "Failed to parse HCS10 bridge message as JSON: {} ({})",
                        trimmed,
                        error
                    );
                    continue;
                }
            };

            let envelope_id = envelope.id.unwrap_or(request_id);
            if envelope_id != request_id {
                log::debug!(
                    "Received response for different request (expected {}, got {})",
                    request_id,
                    envelope_id
                );
                continue;
            }

            if let Some(ref message_type) = envelope.message_type {
                if message_type == "progress" {
                    if let Some(ref data) = envelope.data {
                        on_progress(data)?;
                    }
                    continue;
                }
            }

            if !envelope.success {
                return Err(envelope
                    .error
                    .unwrap_or_else(|| "Unknown HCS10 bridge error".to_string()));
            }

            return Ok(envelope.data.unwrap_or(Value::Null));
        }
    }

    pub async fn register_profile<F>(&self, payload: Value, on_progress: F) -> Result<Value, String>
    where
        F: FnMut(&Value) -> Result<(), String> + Send,
    {
        self.send_request("hcs10_register_profile", payload, on_progress)
            .await
    }

    pub async fn validate_profile(&self, payload: Value) -> Result<Value, String> {
        self.send_request("hcs10_validate_profile", payload, |_| Ok(()))
            .await
    }

    pub async fn retrieve_profile(&self, payload: Value) -> Result<Value, String> {
        self.send_request("hcs10_retrieve_profile", payload, |_| Ok(()))
            .await
    }

    pub async fn cancel_registration(&self) -> Result<Value, String> {
        self.send_request("hcs10_cancel_registration", Value::Null, |_| Ok(()))
            .await
    }
}

#[derive(Debug, Clone)]
pub struct ActiveRegistration {
    pub profile_name: String,
}

pub struct Hcs10Service {
    bridge: Option<Arc<Hcs10Bridge>>,
    states_dir: PathBuf,
    active: Mutex<Option<ActiveRegistration>>,
}

impl Hcs10Service {
    pub fn new(bridge: Option<Arc<Hcs10Bridge>>, states_dir: PathBuf) -> Self {
        if let Err(error) = fs::create_dir_all(&states_dir) {
            log::warn!("Failed to ensure HCS10 state directory exists: {}", error);
        }

        Self {
            bridge,
            states_dir,
            active: Mutex::new(None),
        }
    }

    pub fn bridge(&self) -> Option<Arc<Hcs10Bridge>> {
        self.bridge.clone()
    }

    pub fn states_dir(&self) -> PathBuf {
        self.states_dir.clone()
    }

    fn ensure_state_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.states_dir)
            .map_err(|error| format!("Failed to create state directory: {error}"))
    }

    fn state_file_path(&self, profile_name: &str) -> PathBuf {
        let sanitized = profile_name
            .chars()
            .map(|ch| if ch.is_alphanumeric() { ch } else { '_' })
            .collect::<String>()
            .to_lowercase();
        self.states_dir
            .join(format!("{}_registration_state.json", sanitized))
    }

    fn save_registration_state(&self, profile_name: &str, state: &Value) -> Result<(), String> {
        self.ensure_state_dir()?;
        let mut persisted = state.clone();

        if let Some(object) = persisted.as_object_mut() {
            object.insert(
                "lastUpdated".to_string(),
                Value::String(Utc::now().to_rfc3339()),
            );
            object.insert(
                "profileName".to_string(),
                Value::String(profile_name.to_string()),
            );
        }

        let serialized = serde_json::to_string_pretty(&persisted)
            .map_err(|error| format!("Failed to serialize registration state: {error}"))?;

        fs::write(self.state_file_path(profile_name), serialized)
            .map_err(|error| format!("Failed to write registration state: {error}"))
    }

    fn load_registration_state(&self, profile_name: &str) -> Result<Option<Value>, String> {
        let path = self.state_file_path(profile_name);
        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path)
            .map_err(|error| format!("Failed to read registration state: {error}"))?;

        let mut value: Value = serde_json::from_str(&content)
            .map_err(|error| format!("Invalid registration state JSON: {error}"))?;

        let last_updated = value
            .get("lastUpdated")
            .and_then(Value::as_str)
            .and_then(|ts| ts.parse::<chrono::DateTime<Utc>>().ok());

        if let Some(updated_at) = last_updated {
            let hours = (Utc::now() - updated_at).num_hours();
            if hours >= STATE_EXPIRY_HOURS {
                let _ = fs::remove_file(&path);
                return Ok(None);
            }
        }

        if let Some(object) = value.as_object_mut() {
            object.remove("lastUpdated");
            object.remove("profileName");
        }

        Ok(Some(value))
    }

    fn clear_registration_state(&self, profile_name: &str) -> Result<(), String> {
        let path = self.state_file_path(profile_name);
        if path.exists() {
            fs::remove_file(path)
                .map_err(|error| format!("Failed to clear registration state: {error}"))?;
        }
        Ok(())
    }

    pub fn clear_all_states(&self) -> Result<(), String> {
        if let Ok(entries) = fs::read_dir(&self.states_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.ends_with("_registration_state.json"))
                    .unwrap_or(false)
                {
                    let _ = fs::remove_file(path);
                }
            }
        }
        Ok(())
    }

    pub async fn register_profile(
        &self,
        app_handle: &tauri::AppHandle,
        config_state: &tauri::State<'_, ConfigState>,
        profile_data: Value,
    ) -> Result<Value, String> {
        let bridge = self
            .bridge()
            .ok_or_else(|| "HCS10 bridge not available".to_string())?;

        let profile_name = profile_data
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| "Profile name is required".to_string())?
            .to_string();

        {
            let mut guard = self.active.lock().await;
            if guard.is_some() {
                return Err("Another profile registration is already in progress".to_string());
            }
            *guard = Some(ActiveRegistration {
                profile_name: profile_name.clone(),
            });
        }

        let load_response: LoadConfigResponse =
            load_config(app_handle.clone(), config_state.clone())?;
        let config = load_response.config;

        if config.hedera.account_id.trim().is_empty() || config.hedera.private_key.trim().is_empty()
        {
            self.active.lock().await.take();
            return Err(
                "Missing Hedera credentials. Please configure your Hedera account in Settings."
                    .to_string(),
            );
        }

        let existing_state = self.load_registration_state(&profile_name)?;

        let request_payload = json!({
            "profileData": profile_data.clone(),
            "hedera": {
                "accountId": config.hedera.account_id,
                "privateKey": config.hedera.private_key,
                "network": match config.hedera.network {
                    Network::Mainnet => "mainnet",
                    Network::Testnet => "testnet",
                },
            },
            "options": {
                "isAutonomous": matches!(config.advanced.operational_mode, OperationalMode::Autonomous),
                "existingState": existing_state,
            }
        });

        let states_dir = self.states_dir.clone();
        let profile_name_clone = profile_name.clone();
        let app_handle_clone = app_handle.clone();

        let result = bridge
            .register_profile(request_payload, |progress| {
                if let Some(details) = progress.get("details").and_then(Value::as_object) {
                    if let Some(state) = details.get("state") {
                        let _ = self.save_registration_state(&profile_name_clone, state);
                    }
                }

                let mut enriched = progress.clone();
                if let Some(object) = enriched.as_object_mut() {
                    object
                        .entry("profileName")
                        .or_insert_with(|| Value::String(profile_name_clone.clone()));
                }

                if let Err(error) =
                    app_handle_clone.emit(EVENT_REGISTRATION_PROGRESS, enriched.clone())
                {
                    log::warn!("Failed to emit registration progress: {}", error);
                }

                Ok(())
            })
            .await;

        self.active.lock().await.take();

        match result {
            Ok(value) => {
                self.clear_registration_state(&profile_name_clone)?;
                self.persist_profile(
                    app_handle,
                    config_state,
                    &profile_name_clone,
                    &value,
                    &profile_data,
                )
                .await?;
                Ok(value)
            }
            Err(error) => {
                if error == "Registration cancelled" {
                    self.clear_registration_state(&profile_name_clone)?;
                }
                Err(error)
            }
        }
    }

    async fn persist_profile(
        &self,
        app_handle: &tauri::AppHandle,
        config_state: &tauri::State<'_, ConfigState>,
        profile_name: &str,
        registration_result: &Value,
        profile_data: &Value,
    ) -> Result<(), String> {
        let LoadConfigResponse { mut config, .. } =
            load_config(app_handle.clone(), config_state.clone())?;

        let account_id = registration_result
            .get("accountId")
            .and_then(Value::as_str)
            .unwrap_or(&config.hedera.account_id)
            .to_string();

        let stored = build_stored_profile(profile_data, registration_result, &account_id).await;

        if config
            .hcs10_profiles
            .iter()
            .any(|profile| profile.name == stored.name)
        {
            config.hcs10_profiles = config
                .hcs10_profiles
                .into_iter()
                .map(|profile| {
                    if profile.name == stored.name {
                        stored.clone()
                    } else {
                        profile
                    }
                })
                .collect();
        } else {
            config.hcs10_profiles.push(stored);
        }

        save_config(app_handle.clone(), config_state.clone(), config)
    }

    pub fn get_registration_progress(&self, profile_name: &str) -> Result<Option<Value>, String> {
        self.load_registration_state(profile_name)
    }

    pub async fn is_registration_in_progress(&self, profile_name: &str) -> Result<bool, String> {
        if let Some(active) = self.active.lock().await.as_ref() {
            if active.profile_name == profile_name {
                return Ok(true);
            }
        }

        let existing_state = self.load_registration_state(profile_name)?;
        Ok(existing_state.is_some())
    }

    pub async fn cancel_registration(
        &self,
        bridge: Option<Arc<Hcs10Bridge>>,
    ) -> Result<(), String> {
        if let Some(bridge) = bridge {
            let _ = bridge.cancel_registration().await;
        }
        let mut guard = self.active.lock().await;
        if let Some(active) = guard.take() {
            let _ = self.clear_registration_state(&active.profile_name);
        }
        Ok(())
    }
}

pub async fn build_stored_profile(
    profile_data: &Value,
    registration_result: &Value,
    account_id: &str,
) -> StoredHcs10Profile {
    let name = profile_data
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let description = profile_data
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let capabilities = profile_data
        .get("capabilities")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let socials_value = profile_data.get("socials").and_then(Value::as_object);
    let socials = socials_value.map(|object| ProfileSocials {
        twitter: object
            .get("twitter")
            .and_then(Value::as_str)
            .map(|value| value.to_string()),
        github: object
            .get("github")
            .and_then(Value::as_str)
            .map(|value| value.to_string()),
        website: object
            .get("website")
            .and_then(Value::as_str)
            .map(|value| value.to_string()),
    });

    let profile_image = profile_data
        .get("profileImage")
        .and_then(Value::as_str)
        .map(|value| value.to_string());

    let fee_configuration = profile_data
        .get("feeConfiguration")
        .filter(|value| !value.is_null())
        .cloned();

    let timestamp = registration_result
        .get("timestamp")
        .and_then(Value::as_str)
        .map(|value| value.to_string())
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    StoredHcs10Profile {
        id: format!("hcs10-{}", Uuid::new_v4()),
        account_id: account_id.to_string(),
        name,
        description,
        capabilities,
        socials,
        profile_image,
        fee_configuration,
        registered_at: timestamp.clone(),
        last_updated: timestamp,
        status: ProfileStatus::Active,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn stored_profile_extracts_core_fields() {
        let profile_data = json!({
            "name": "Test Agent",
            "description": "Helps with testing",
            "capabilities": ["text-generation", "analytics"],
            "socials": {
                "twitter": "@test",
                "github": "test",
                "website": "https://example.com"
            },
            "profileImage": "ipfs://image",
            "feeConfiguration": {
                "hbarFee": "0.5"
            }
        });

        let registration_result = json!({
            "timestamp": "2025-09-29T12:00:00.000Z",
            "profileUrl": "https://kiloscribe.com/profile/1",
        });

        let stored = build_stored_profile(&profile_data, &registration_result, "0.0.12345").await;

        assert_eq!(stored.name, "Test Agent");
        assert_eq!(stored.description, "Helps with testing");
        assert_eq!(stored.capabilities, vec!["text-generation", "analytics"]);
        assert_eq!(stored.account_id, "0.0.12345");
        assert_eq!(stored.status, ProfileStatus::Active);

        let socials = stored.socials.expect("socials should be present");
        assert_eq!(socials.twitter.as_deref(), Some("@test"));
        assert_eq!(socials.github.as_deref(), Some("test"));
        assert_eq!(socials.website.as_deref(), Some("https://example.com"));

        assert_eq!(stored.profile_image.as_deref(), Some("ipfs://image"));
        assert!(stored.fee_configuration.is_some());
        assert!(!stored.registered_at.is_empty());
        assert!(!stored.last_updated.is_empty());
    }

    #[test]
    fn state_file_path_sanitizes_name() {
        let service = Hcs10Service::new(None, PathBuf::from("/tmp/hcs10-states"));
        let path = service.state_file_path("Agent Name !");
        assert!(path.ends_with("agent_name___registration_state.json"));
    }

    #[test]
    fn registration_progress_event_is_snake_cased() {
        assert_eq!(EVENT_REGISTRATION_PROGRESS, "hcs10_registration_progress");
    }
}
