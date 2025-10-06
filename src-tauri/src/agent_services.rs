use std::collections::VecDeque;
use std::sync::Arc;

use chrono::Utc;
use serde_json::{Map, Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::agent::{
    AgentInitializeConfig, AgentInitializeData, AgentInitializeResponse, AgentMessageData,
    AgentMessageRequest, AgentMessageResponse, AgentStatusResponse, Attachment, FormSubmission,
};
use crate::node_agent::{AgentInitializeConfigPayload, NodeAgentBackend};
use crate::session::{ChatMessage, SessionService};
use crate::wallet_bridge::{WalletBridgeInfo, WalletBridgeState};
use crate::{AgentBackend, EchoAgent};
use std::path::PathBuf;

#[derive(Default)]
pub struct InitializationService {
    initialized: bool,
    session_id: Option<String>,
    last_config: Option<ConfigSnapshot>,
    backend: Option<Arc<dyn AgentBackend + Send + Sync>>,
    bridge_script: Option<PathBuf>,
}

#[derive(Clone, PartialEq, Eq)]
struct ConfigSnapshot {
    account_id: String,
    private_key: String,
    network: String,
    open_ai_api_key: String,
    model_name: Option<String>,
    llm_provider: Option<String>,
    user_account_id: Option<String>,
    operational_mode: Option<String>,
    mcp_signature: Option<String>,
    verbose: Option<bool>,
    disable_logging: Option<bool>,
}

impl InitializationService {
    pub fn new(bridge_script: Option<PathBuf>) -> Self {
        Self {
            backend: None,
            bridge_script,
            ..Self::default()
        }
    }

    pub fn set_bridge_script(&mut self, bridge_script: Option<PathBuf>) {
        self.bridge_script = bridge_script;
    }

    pub async fn initialize(
        &mut self,
        config: AgentInitializeConfig,
        wallet_bridge: WalletBridgeState,
        wallet_info: Arc<Mutex<Option<WalletBridgeInfo>>>,
    ) -> AgentInitializeResponse {
        if config.account_id.trim().is_empty() || config.open_ai_api_key.trim().is_empty() {
            return AgentInitializeResponse {
                success: false,
                data: None,
                error: Some("Account ID and OpenAI API key are required".to_string()),
            };
        }

        let wallet_operational_mode = matches!(
            config.operational_mode.as_deref(),
            Some("provideBytes") | Some("returnBytes")
        );

        if config.private_key.trim().is_empty() && !wallet_operational_mode {
            return AgentInitializeResponse {
                success: false,
                data: None,
                error: Some("Private key is required".to_string()),
            };
        }

        let snapshot = ConfigSnapshot {
            account_id: config.account_id.clone(),
            private_key: config.private_key.clone(),
            network: config.network.clone(),
            open_ai_api_key: config.open_ai_api_key.clone(),
            model_name: config.model_name.clone(),
            llm_provider: config.llm_provider.clone(),
            user_account_id: config.user_account_id.clone(),
            operational_mode: config.operational_mode.clone(),
            mcp_signature: config
                .mcp_servers
                .as_ref()
                .and_then(|value| serde_json::to_string(value).ok()),
            verbose: config.verbose,
            disable_logging: config.disable_logging,
        };

        if let Some(previous) = &self.last_config {
            if previous == &snapshot {
                if let Some(session_id) = &self.session_id {
                    return AgentInitializeResponse {
                        success: true,
                        data: Some(AgentInitializeData {
                            session_id: session_id.clone(),
                        }),
                        error: None,
                    };
                }
            }
        }

        let session_id = Uuid::new_v4().to_string();
        let mut backend: Option<Arc<dyn AgentBackend + Send + Sync>> = None;

        if let Some(ref path) = self.bridge_script {
            match NodeAgentBackend::spawn(path.clone(), wallet_bridge.clone(), wallet_info.clone())
                .await
            {
                Ok(node_backend) => {
                    let payload: AgentInitializeConfigPayload = config.clone().into();
                    if let Err(error) = node_backend.initialize(&payload).await {
                        self.initialized = false;
                        self.session_id = None;
                        self.backend = None;
                        return AgentInitializeResponse {
                            success: false,
                            data: None,
                            error: Some(error),
                        };
                    }
                    log::info!("Node conversational agent backend initialized");
                    backend = Some(Arc::new(node_backend));
                }
                Err(error) => {
                    self.initialized = false;
                    self.session_id = None;
                    self.backend = None;
                    return AgentInitializeResponse {
                        success: false,
                        data: None,
                        error: Some(error),
                    };
                }
            }
        } else {
            log::info!("No bridge script found; using echo backend");
            backend = Some(Arc::new(EchoAgent::new()));
        }

        self.initialized = true;
        self.session_id = Some(session_id.clone());
        self.last_config = Some(snapshot);
        self.backend = backend;

        AgentInitializeResponse {
            success: true,
            data: Some(AgentInitializeData { session_id }),
            error: None,
        }
    }

    pub fn status(&self, active_messages: usize) -> AgentStatusResponse {
        AgentStatusResponse {
            connected: self.initialized,
            session_id: self.session_id.clone(),
            active_messages: if active_messages == 0 {
                None
            } else {
                Some(active_messages)
            },
        }
    }

    pub async fn disconnect(&mut self) {
        self.initialized = false;
        self.session_id = None;
        if let Some(backend) = self.backend.take() {
            let _ = backend.disconnect().await;
        }
    }

    pub fn session_id(&self) -> Option<String> {
        self.session_id.clone()
    }

    pub fn backend(&self) -> Option<Arc<dyn AgentBackend + Send + Sync>> {
        self.backend.clone()
    }

    pub fn set_backend(&mut self, backend: Arc<dyn AgentBackend + Send + Sync>) {
        self.backend = Some(backend);
    }
}

pub struct MessageService {
    history: Mutex<VecDeque<String>>,
}

impl MessageService {
    pub fn new() -> Self {
        Self {
            history: Mutex::new(VecDeque::new()),
        }
    }

    pub async fn reset(&self) {
        let mut guard = self.history.lock().await;
        guard.clear();
    }

    pub async fn active_messages(&self) -> usize {
        self.history.lock().await.len()
    }

    pub async fn process(
        &self,
        session_service: &SessionService,
        session_id: &str,
        mut request: AgentMessageRequest,
        backend: Arc<dyn AgentBackend + Send + Sync>,
    ) -> Result<AgentMessageResponse, String> {
        if request.content.trim().is_empty() {
            return Ok(AgentMessageResponse {
                success: false,
                response: None,
                error: Some("Message content must not be empty".to_string()),
            });
        }

        if let Some(provided) = request.session_id.as_ref() {
            if provided != session_id {
                return Ok(AgentMessageResponse {
                    success: false,
                    response: None,
                    error: Some("Unknown session ID".to_string()),
                });
            }
        }

        let mut history = self.history.lock().await;
        history.push_back(request.content.clone());
        if history.len() > 50 {
            history.pop_front();
        }
        let active_messages = history.len();
        drop(history);

        let timestamp = Utc::now().to_rfc3339();
        if let Some(form_submission) = request.form_submission.as_mut() {
            let mut parameters = match form_submission.data.take() {
                Some(Value::Object(map)) => map,
                Some(_) => Map::new(),
                None => Map::new(),
            };

            parameters.insert("renderForm".to_string(), Value::Bool(false));
            parameters.insert("waitForConfirmation".to_string(), Value::Bool(true));
            parameters.insert("withHashLinkBlocks".to_string(), Value::Bool(true));

            form_submission.data = Some(Value::Object(parameters));
        }

        let mut metadata_map = Map::new();
        metadata_map.insert(
            "chatHistoryLength".to_string(),
            json!(
                request
                    .chat_history
                    .as_ref()
                    .map_or(0, |history| history.len())
            ),
        );
        metadata_map.insert("processedAt".to_string(), json!(&timestamp));
        metadata_map.insert("activeMessages".to_string(), json!(active_messages));

        if let Some(ref attachments) = request.attachments {
            metadata_map.insert("attachments".to_string(), attachments_metadata(attachments));
        }

        if let Some(ref form_submission) = request.form_submission {
            metadata_map.insert(
                "formSubmission".to_string(),
                form_submission_metadata(form_submission),
            );
        }

        let metadata_value = Value::Object(metadata_map.clone());

        let assistant_message = backend
            .send_message(&request, metadata_value.clone(), &timestamp)
            .await
            .map_err(|error| error.to_string())?;

        let persisted_metadata = assistant_message
            .metadata
            .clone()
            .unwrap_or(Value::Object(metadata_map));

        let message_type = assistant_message
            .metadata
            .as_ref()
            .and_then(|value| value.get("messageType"))
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .unwrap_or_else(|| "text".to_string());

        let chat_message = ChatMessage {
            id: assistant_message.id.clone(),
            role: assistant_message.role.clone(),
            content: assistant_message.content.clone(),
            timestamp: assistant_message.timestamp.clone(),
            message_type: Some(message_type),
            metadata: Some(persisted_metadata.clone()),
        };

        session_service
            .save_message(session_id, chat_message)
            .await?;

        Ok(AgentMessageResponse {
            success: true,
            response: Some(AgentMessageData {
                metadata: Some(persisted_metadata),
                form_message: assistant_message.form_message.clone(),
                ..assistant_message
            }),
            error: None,
        })
    }
}

fn attachments_metadata(attachments: &[Attachment]) -> Value {
    json!({
        "count": attachments.len(),
        "items": attachments
            .iter()
            .map(|attachment| json!({
                "name": attachment.name,
                "type": attachment.attachment_type,
                "size": attachment.size,
            }))
            .collect::<Vec<Value>>(),
    })
}

fn form_submission_metadata(form_submission: &FormSubmission) -> Value {
    json!({
        "formId": form_submission.form_id,
        "toolName": form_submission.tool_name,
        "data": form_submission.data,
        "timestamp": form_submission.timestamp,
        "originalPrompt": form_submission.original_prompt,
        "partialInput": form_submission.partial_input,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BackendError;
    use crate::agent::ChatEntry;
    use async_trait::async_trait;
    use std::sync::Arc;

    fn sample_config() -> AgentInitializeConfig {
        AgentInitializeConfig {
            account_id: "0.0.5005".to_string(),
            private_key: "302e020100300506032b657004220420".to_string(),
            network: "testnet".to_string(),
            open_ai_api_key: "sk-test".to_string(),
            model_name: Some("gpt-test".to_string()),
            llm_provider: Some("openai".to_string()),
            user_account_id: Some("0.0.7007".to_string()),
            operational_mode: Some("provideBytes".to_string()),
            mcp_servers: None,
            verbose: None,
            disable_logging: None,
            disabled_plugins: None,
        }
    }

    fn test_wallet_bridge() -> (WalletBridgeState, Arc<Mutex<Option<WalletBridgeInfo>>>) {
        (WalletBridgeState::default(), Arc::new(Mutex::new(None)))
    }

    #[tokio::test]
    async fn initialization_generates_session_and_reuses_when_config_matches() {
        let mut service = InitializationService::new(None);
        let (bridge, info) = test_wallet_bridge();
        let first = service
            .initialize(sample_config(), bridge.clone(), Arc::clone(&info))
            .await;
        assert!(first.success);
        let first_session = first.data.unwrap().session_id;

        let second = service
            .initialize(sample_config(), bridge.clone(), Arc::clone(&info))
            .await;
        assert!(second.success);
        let second_session = second.data.unwrap().session_id;
        assert_eq!(first_session, second_session);
    }

    #[tokio::test]
    async fn initialization_allows_missing_private_key_for_wallet_modes() {
        let mut service = InitializationService::new(None);
        let mut config = sample_config();
        config.private_key = String::new();
        config.operational_mode = Some("provideBytes".to_string());
        let (bridge, info) = test_wallet_bridge();
        let result = service.initialize(config, bridge, info).await;
        assert!(
            result.success,
            "expected initialization to succeed even without private key for provideBytes mode"
        );
    }

    #[tokio::test]
    async fn message_service_persists_assistant_messages_with_metadata() {
        let session_service = SessionService::new_in_memory();
        let session = session_service
            .create_session(crate::session::CreateSessionInput {
                name: "Test".to_string(),
                mode: "personal".to_string(),
                topic_id: None,
                is_active: true,
            })
            .await;

        let service = MessageService::new();
        let request = AgentMessageRequest {
            session_id: Some(session.id.clone()),
            content: "Hello agent".to_string(),
            chat_history: Some(vec![ChatEntry {
                entry_type: "human".to_string(),
                content: "Hello agent".to_string(),
            }]),
            attachments: Some(vec![Attachment {
                name: "info.txt".to_string(),
                data: "SGVsbG8=".to_string(),
                attachment_type: "text/plain".to_string(),
                size: 5,
            }]),
            form_submission: Some(FormSubmission {
                form_id: "form-123".to_string(),
                tool_name: "test-tool".to_string(),
                data: Some(json!({ "value": 42 })),
                timestamp: Some(1234),
                original_prompt: Some("prompt".to_string()),
                partial_input: None,
            }),
        };

        let response = service
            .process(
                &session_service,
                &session.id,
                request,
                Arc::new(EchoAgent::new()),
            )
            .await
            .expect("process message");

        assert!(response.success);
        let stored = session_service
            .load_messages(&session.id)
            .await
            .expect("load messages");
        assert_eq!(stored.len(), 1);
        let metadata = stored[0].metadata.clone().expect("metadata");
        assert_eq!(metadata["attachments"]["count"], json!(1));
        assert_eq!(metadata["formSubmission"]["formId"], json!("form-123"));
        assert_eq!(metadata["chatHistoryLength"], json!(1));
    }

    #[tokio::test]
    async fn message_service_surfaces_backend_errors() {
        struct FailingBackend;

        #[async_trait]
        impl AgentBackend for FailingBackend {
            async fn send_message(
                &self,
                _request: &AgentMessageRequest,
                _metadata: Value,
                _timestamp: &str,
            ) -> Result<AgentMessageData, BackendError> {
                Err(BackendError::Failure("backend error".to_string()))
            }
        }

        let session_service = SessionService::new_in_memory();
        let session = session_service
            .create_session(crate::session::CreateSessionInput {
                name: "Fail".to_string(),
                mode: "personal".to_string(),
                topic_id: None,
                is_active: true,
            })
            .await;

        let service = MessageService::new();
        let result = service
            .process(
                &session_service,
                &session.id,
                AgentMessageRequest {
                    session_id: Some(session.id.clone()),
                    content: "Hello".to_string(),
                    chat_history: None,
                    attachments: None,
                    form_submission: None,
                },
                Arc::new(FailingBackend),
            )
            .await;

        assert!(result.is_err());
        assert_eq!(
            result.err().unwrap(),
            "agent backend failure: backend error".to_string()
        );
    }
}
