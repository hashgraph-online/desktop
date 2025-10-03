use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::AgentBackend;
use crate::BackendError;
use crate::agent::{AgentMessageData, AgentMessageRequest};
use crate::wallet_bridge::{
    WalletBridgeInfo, WalletBridgeState, wallet_execute_bytes, wallet_start_inscription,
    wallet_status_json,
};

pub struct NodeAgentBackend {
    process: Mutex<NodeProcess>,
    wallet_bridge: WalletBridgeState,
    wallet_info: Arc<Mutex<Option<WalletBridgeInfo>>>,
}

struct NodeProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

impl NodeAgentBackend {
    pub async fn spawn(
        script_path: PathBuf,
        wallet_bridge: WalletBridgeState,
        wallet_info: Arc<Mutex<Option<WalletBridgeInfo>>>,
    ) -> Result<Self, String> {
        let mut command = Command::new("node");
        command
            .arg(&script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());

        if let Some(parent) = script_path.parent() {
            command.current_dir(parent);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn agent bridge: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to access bridge stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to access bridge stdout".to_string())?;

        Ok(Self {
            process: Mutex::new(NodeProcess {
                child,
                stdin,
                stdout: BufReader::new(stdout),
                next_id: 0,
            }),
            wallet_bridge,
            wallet_info,
        })
    }

    async fn request(&self, action: &str, payload: Value) -> Result<Value, String> {
        let mut guard = self.process.lock().await;
        guard.next_id += 1;
        let request_id = guard.next_id;
        let request = BridgeRequest {
            id: request_id,
            action,
            payload,
        };

        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize request: {error}"))?
            + "\n";

        guard
            .stdin
            .write_all(serialized.as_bytes())
            .await
            .map_err(|error| format!("Failed to write to agent bridge: {error}"))?;
        guard
            .stdin
            .flush()
            .await
            .map_err(|error| format!("Failed to flush agent bridge: {error}"))?;

        log::debug!(
            "Agent bridge request sent (id {}): {}",
            request_id,
            serialized.trim_end_matches('\n')
        );

        let mut response_line = String::new();

        loop {
            response_line.clear();
            let read_bytes = tokio::time::timeout(
                std::time::Duration::from_secs(120),
                guard.stdout.read_line(&mut response_line),
            )
            .await
            .map_err(|_| "Agent bridge timed out while waiting for response".to_string())?
            .map_err(|error| format!("Failed to read agent bridge response: {error}"))?;

            if read_bytes == 0 {
                return Err("Agent bridge closed the stream unexpectedly".to_string());
            }

            let trimmed = response_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            log::debug!("Agent bridge raw response: {}", trimmed);

            if !trimmed.starts_with('{') {
                log::debug!("Skipping non-response output: {}", trimmed);
                continue;
            }

            let value: Value = match serde_json::from_str(trimmed) {
                Ok(value) => value,
                Err(error) => {
                    log::debug!(
                        "Failed to parse candidate response as JSON object: {} (error: {})",
                        trimmed,
                        error
                    );
                    continue;
                }
            };

            if let Some(bridge_value) = value.get("bridgeRequest") {
                match serde_json::from_value::<BridgeRequestPayload>(bridge_value.clone()) {
                    Ok(bridge_request) => {
                        let request_id_str = bridge_request.id.clone();
                        let result = self.handle_bridge_request(&bridge_request).await;
                        let (success, data, error) = match result {
                            Ok(value) => (true, Some(value), None),
                            Err(err) => (false, None, Some(err)),
                        };
                        let envelope = json!({
                            "bridgeResponse": {
                                "id": request_id_str,
                                "success": success,
                                "data": data,
                                "error": error,
                            }
                        });
                        let serialized = serde_json::to_string(&envelope)
                            .map_err(|err| format!("Failed to serialize bridge response: {err}"))?
                            + "\n";
                        guard
                            .stdin
                            .write_all(serialized.as_bytes())
                            .await
                            .map_err(|error| format!("Failed to write bridge response: {error}"))?;
                        guard
                            .stdin
                            .flush()
                            .await
                            .map_err(|error| format!("Failed to flush bridge response: {error}"))?;
                        continue;
                    }
                    Err(error) => {
                        log::warn!("Ignoring malformed bridge request: {}", error);
                        continue;
                    }
                }
            }

            let response_id = value
                .get("id")
                .and_then(Value::as_u64)
                .unwrap_or(request_id);

            if response_id != request_id {
                log::debug!(
                    "Skipping response for different request (expected {}, got {})",
                    request_id,
                    response_id
                );
                continue;
            }

            let response: BridgeResponse =
                serde_json::from_value(value).map_err(|parse_error| {
                    format!("Failed to deserialize bridge response: {parse_error}")
                })?;

            if !response.success {
                return Err(response
                    .error
                    .unwrap_or_else(|| "Unknown agent bridge error".to_string()));
            }

            let payload = response.data.unwrap_or(Value::Null);
            match action {
                "sendMessage" => {
                    if payload
                        .as_object()
                        .map(|object| object.contains_key("response"))
                        .unwrap_or(false)
                    {
                        return Ok(payload);
                    }
                    log::debug!(
                        "Skipping sendMessage payload without response field: {}",
                        trimmed
                    );
                }
                "initialize" => {
                    if payload
                        .as_object()
                        .map(|object| object.contains_key("initialized"))
                        .unwrap_or(false)
                    {
                        return Ok(payload);
                    }
                    log::debug!(
                        "Skipping initialize payload without initialized field: {}",
                        trimmed
                    );
                }
                "status" | "disconnect" | _ => {
                    return Ok(payload);
                }
            }
        }
    }

    pub async fn initialize(&self, config: &AgentInitializeConfigPayload) -> Result<(), String> {
        self.request(
            "initialize",
            serde_json::to_value(config).map_err(|e| e.to_string())?,
        )
        .await
        .map(|_| ())
    }

    async fn handle_bridge_request(&self, request: &BridgeRequestPayload) -> Result<Value, String> {
        match request.action.as_str() {
            "wallet_status" => Ok(wallet_status_json(&self.wallet_bridge, &self.wallet_info).await),
            "wallet_execute_tx" => {
                #[derive(Deserialize)]
                struct ExecutePayload {
                    base64: String,
                    network: String,
                }
                let payload: ExecutePayload = serde_json::from_value(request.payload.clone())
                    .map_err(|err| format!("Invalid wallet execute payload: {err}"))?;
                wallet_execute_bytes(&self.wallet_bridge, payload.base64, payload.network).await
            }
            "wallet_inscribe_start" => {
                #[derive(Deserialize)]
                struct InscriptionPayload {
                    request: Value,
                    network: String,
                }
                let payload: InscriptionPayload =
                    serde_json::from_value(request.payload.clone())
                        .map_err(|err| format!("Invalid wallet inscription payload: {err}"))?;
                wallet_start_inscription(&self.wallet_bridge, payload.request, payload.network)
                    .await
            }
            other => Err(format!("Unsupported bridge action: {other}")),
        }
    }
}

impl Drop for NodeProcess {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
    }
}

#[derive(Serialize)]
struct BridgeRequest<'a> {
    id: u64,
    action: &'a str,
    payload: Value,
}

#[derive(Deserialize)]
struct BridgeResponse {
    _id: Option<u64>,
    success: bool,
    #[serde(default)]
    data: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Deserialize)]
struct BridgeRequestPayload {
    id: String,
    action: String,
    #[serde(default)]
    payload: Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInitializeConfigPayload {
    pub account_id: String,
    pub private_key: String,
    pub network: String,
    #[serde(rename = "openAIApiKey")]
    pub open_ai_api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operational_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_servers: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verbose: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable_logging: Option<bool>,
    #[serde(rename = "disabledPlugins", skip_serializing_if = "Option::is_none")]
    pub disabled_plugins: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct BridgeMessagePayload {
    response: Value,
    #[serde(default)]
    attachments: Value,
}

#[async_trait::async_trait]
impl AgentBackend for NodeAgentBackend {
    async fn send_message(
        &self,
        request: &AgentMessageRequest,
        metadata: Value,
        timestamp: &str,
    ) -> Result<AgentMessageData, BackendError> {
        let payload = json!({
            "content": request.content,
            "chatHistory": request.chat_history.clone(),
            "attachments": request.attachments.clone(),
            "formSubmission": request.form_submission.clone(),
            "metadata": metadata,
        });

        let response_value = self
            .request("sendMessage", payload)
            .await
            .map_err(BackendError::Failure)?;

        let payload: BridgeMessagePayload = serde_json::from_value(response_value)
            .map_err(|error| BackendError::Failure(error.to_string()))?;

        let message_value = payload.response;
        let content = message_value
            .get("message")
            .and_then(|value| value.as_str())
            .or_else(|| message_value.get("output").and_then(|value| value.as_str()))
            .unwrap_or_default()
            .to_string();

        let mut metadata = message_value
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

        if let Value::Object(ref mut map) = metadata {
            for (key, value) in [
                ("transactionId", message_value.get("transactionId")),
                ("scheduleId", message_value.get("scheduleId")),
                ("notes", message_value.get("notes")),
                ("formMessage", message_value.get("formMessage")),
                ("hashLinkBlock", message_value.get("hashLinkBlock")),
            ] {
                if let Some(v) = value {
                    map.insert(key.to_string(), v.clone());
                }
            }

            if !payload.attachments.is_null() {
                map.insert("attachments".to_string(), payload.attachments);
            }
        }

        Ok(AgentMessageData {
            id: format!("msg-{}", Uuid::new_v4()),
            role: "assistant".to_string(),
            content,
            timestamp: timestamp.to_string(),
            metadata: Some(metadata),
            form_message: message_value.get("formMessage").cloned(),
        })
    }

    async fn disconnect(&self) -> Result<(), BackendError> {
        self.request("disconnect", Value::Null)
            .await
            .map(|_| ())
            .map_err(BackendError::Failure)
    }
}

impl Drop for NodeAgentBackend {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.process.try_lock() {
            let _ = guard.child.start_kill();
        }
    }
}

impl From<crate::agent::AgentInitializeConfig> for AgentInitializeConfigPayload {
    fn from(value: crate::agent::AgentInitializeConfig) -> Self {
        Self {
            account_id: value.account_id,
            private_key: value.private_key,
            network: value.network,
            open_ai_api_key: value.open_ai_api_key,
            model_name: value.model_name,
            llm_provider: value.llm_provider,
            user_account_id: value.user_account_id,
            operational_mode: value.operational_mode,
            mcp_servers: value.mcp_servers,
            verbose: value.verbose,
            disable_logging: value.disable_logging,
            disabled_plugins: value.disabled_plugins,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn payload_includes_optional_fields() {
        let config = crate::agent::AgentInitializeConfig {
            account_id: "0.0.1001".to_string(),
            private_key: "302e020100300506032b657004220420".to_string(),
            network: "testnet".to_string(),
            open_ai_api_key: "sk-test".to_string(),
            model_name: Some("gpt-test".to_string()),
            llm_provider: Some("openai".to_string()),
            user_account_id: Some("0.0.2002".to_string()),
            operational_mode: Some("provideBytes".to_string()),
            mcp_servers: Some(json!([{ "id": "server-1" }])),
            verbose: None,
            disable_logging: None,
            disabled_plugins: None,
        };

        let payload = AgentInitializeConfigPayload::from(config);
        assert_eq!(payload.operational_mode.as_deref(), Some("provideBytes"));
        assert_eq!(payload.user_account_id.as_deref(), Some("0.0.2002"));
        assert!(payload.mcp_servers.is_some());
        assert!(payload.mcp_servers.unwrap().is_array());
    }
}
