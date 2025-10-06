use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::AgentBackend;
use crate::agent_services::{InitializationService, MessageService};
use crate::session::SessionService;
use crate::wallet_bridge::{WalletBridgeInfo, WalletBridgeState};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentInitializeConfig {
    pub account_id: String,
    pub private_key: String,
    pub network: String,
    #[serde(rename = "openAIApiKey")]
    pub open_ai_api_key: String,
    #[serde(default)]
    pub model_name: Option<String>,
    #[serde(default)]
    pub llm_provider: Option<String>,
    #[serde(default)]
    pub user_account_id: Option<String>,
    #[serde(default)]
    pub operational_mode: Option<String>,
    #[serde(default)]
    pub mcp_servers: Option<Value>,
    #[serde(default)]
    pub verbose: Option<bool>,
    #[serde(default)]
    pub disable_logging: Option<bool>,
    #[serde(default)]
    pub disabled_plugins: Option<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentInitializeResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<AgentInitializeData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentInitializeData {
    pub session_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusResponse {
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_messages: Option<usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessageRequest {
    #[serde(rename = "sessionId", default)]
    pub session_id: Option<String>,
    pub content: String,
    #[serde(default)]
    pub chat_history: Option<Vec<ChatEntry>>,
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,
    #[serde(default)]
    pub form_submission: Option<FormSubmission>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatEntry {
    #[serde(rename = "type")]
    pub entry_type: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub name: String,
    pub data: String,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub size: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FormSubmission {
    pub form_id: String,
    pub tool_name: String,
    #[serde(default)]
    pub data: Option<Value>,
    #[serde(default)]
    pub timestamp: Option<i64>,
    #[serde(default)]
    pub original_prompt: Option<String>,
    #[serde(default)]
    pub partial_input: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessageResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<AgentMessageData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessageData {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub form_message: Option<serde_json::Value>,
}

pub struct AgentService {
    initialization: Mutex<InitializationService>,
    message_service: MessageService,
    session_context: Mutex<Option<AgentSessionContext>>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionContext {
    pub session_id: String,
    pub mode: String,
    #[serde(default)]
    pub topic_id: Option<String>,
}

impl AgentService {
    pub fn new() -> Self {
        Self::with_bridge(None)
    }

    pub fn with_bridge(bridge: Option<PathBuf>) -> Self {
        Self {
            initialization: Mutex::new(InitializationService::new(bridge)),
            message_service: MessageService::new(),
            session_context: Mutex::new(None),
        }
    }

    pub async fn initialize(
        &self,
        config: AgentInitializeConfig,
        wallet_bridge: WalletBridgeState,
        wallet_info: Arc<Mutex<Option<WalletBridgeInfo>>>,
    ) -> Result<AgentInitializeResponse> {
        let mut initialization = self.initialization.lock().await;
        Ok(initialization
            .initialize(config, wallet_bridge, wallet_info)
            .await)
    }

    pub async fn status(&self) -> AgentStatusResponse {
        let initialization = self.initialization.lock().await;
        let active_messages = self.message_service.active_messages().await;
        initialization.status(active_messages)
    }

    pub async fn disconnect(&self) {
        {
            let mut initialization = self.initialization.lock().await;
            initialization.disconnect().await;
        }
        self.message_service.reset().await;
        let mut context = self.session_context.lock().await;
        *context = None;
    }

    pub async fn send_message(
        &self,
        session_service: &SessionService,
        request: AgentMessageRequest,
    ) -> Result<AgentMessageResponse> {
        let (session_id, backend) = {
            let initialization = self.initialization.lock().await;
            let session_id = match initialization.session_id() {
                Some(id) => id.to_string(),
                None => {
                    return Ok(AgentMessageResponse {
                        success: false,
                        response: None,
                        error: Some("Agent session is not initialized".to_string()),
                    });
                }
            };

            let backend = match initialization.backend() {
                Some(backend) => backend,
                None => {
                    return Ok(AgentMessageResponse {
                        success: false,
                        response: None,
                        error: Some("Agent backend is not available".to_string()),
                    });
                }
            };

            (session_id, backend)
        };

        self.message_service
            .process(session_service, &session_id, request, backend)
            .await
            .map_err(|error| anyhow!(error))
    }

    pub async fn update_session_context(&self, context: AgentSessionContext) {
        let mut guard = self.session_context.lock().await;
        *guard = Some(context);
    }

    pub async fn session_context(&self) -> Option<AgentSessionContext> {
        let guard = self.session_context.lock().await;
        guard.clone()
    }

    pub async fn set_backend(&self, backend: Arc<dyn AgentBackend + Send + Sync>) {
        let mut initialization = self.initialization.lock().await;
        initialization.set_backend(backend);
    }

    pub async fn set_bridge_script(&self, bridge: Option<PathBuf>) {
        let mut initialization = self.initialization.lock().await;
        initialization.set_bridge_script(bridge);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::{ChatSession, SessionService};
    use crate::{AgentBackend, BackendError};
    use async_trait::async_trait;
    use chrono::Utc;
    use serde_json::json;
    use uuid::Uuid;

    fn sample_config() -> AgentInitializeConfig {
        AgentInitializeConfig {
            account_id: "0.0.1234".to_string(),
            private_key: "302e...".to_string(),
            network: "testnet".to_string(),
            open_ai_api_key: "sk-test".to_string(),
            model_name: Some("gpt-test".to_string()),
            llm_provider: Some("openai".to_string()),
            user_account_id: None,
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
    async fn initialize_sets_session_id() {
        let service = AgentService::new();
        let (bridge, info) = test_wallet_bridge();
        let result = service
            .initialize(sample_config(), bridge.clone(), Arc::clone(&info))
            .await
            .unwrap();
        assert!(result.success);
        let session_id = result.data.as_ref().unwrap().session_id.clone();
        let status = service.status().await;
        assert!(status.connected);
        assert_eq!(status.session_id, Some(session_id));
    }

    #[tokio::test]
    async fn initialize_requires_credentials() {
        let service = AgentService::new();
        let mut config = sample_config();
        config.account_id = "".into();
        let (bridge, info) = test_wallet_bridge();
        let result = service.initialize(config, bridge, info).await.unwrap();
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Account ID"));
    }

    #[tokio::test]
    async fn send_message_requires_session() {
        let service = AgentService::new();
        let session_service = SessionService::new_in_memory();
        let response = service
            .send_message(
                &session_service,
                AgentMessageRequest {
                    session_id: None,
                    content: "hello".into(),
                    chat_history: None,
                    attachments: None,
                    form_submission: None,
                },
            )
            .await
            .unwrap();

        assert!(!response.success);
        assert!(response.error.unwrap().contains("not initialized"));
    }

    #[tokio::test]
    async fn send_message_echoes_content() {
        let service = AgentService::new();
        let session_service = SessionService::new_in_memory();
        let (bridge, info) = test_wallet_bridge();
        service
            .initialize(sample_config(), bridge.clone(), Arc::clone(&info))
            .await
            .unwrap();
        let initial_status = service.status().await;
        let session_id = initial_status.session_id.clone().unwrap();

        let now = Utc::now().to_rfc3339();
        session_service
            .save_session(ChatSession {
                id: session_id.clone(),
                name: "Personal".into(),
                mode: "personal".into(),
                topic_id: None,
                created_at: now.clone(),
                updated_at: now.clone(),
                last_message_at: None,
                is_active: true,
                messages: vec![],
            })
            .await
            .unwrap();

        let response = service
            .send_message(
                &session_service,
                AgentMessageRequest {
                    session_id: Some(session_id.clone()),
                    content: "Hello world".into(),
                    chat_history: Some(vec![ChatEntry {
                        entry_type: "human".into(),
                        content: "Hello world".into(),
                    }]),
                    attachments: Some(vec![Attachment {
                        name: "note.txt".into(),
                        data: "SGVsbG8=".into(),
                        attachment_type: "text/plain".into(),
                        size: 5,
                    }]),
                    form_submission: None,
                },
            )
            .await
            .unwrap();

        assert!(response.success);
        let message = response.response.unwrap();
        assert_eq!(message.content, "Echo: Hello world");
        assert_eq!(message.role, "assistant");
        assert_eq!(message.metadata.unwrap()["attachments"]["count"], json!(1));

        let stored = session_service.load_messages(&session_id).await.unwrap();
        assert_eq!(stored.len(), 1);

        let status = service.status().await;
        assert_eq!(status.active_messages, Some(1));
        assert_eq!(status.session_id, Some(session_id));
    }

    struct RecordingBackend;

    #[async_trait]
    impl AgentBackend for RecordingBackend {
        async fn send_message(
            &self,
            _request: &AgentMessageRequest,
            metadata: Value,
            timestamp: &str,
        ) -> Result<AgentMessageData, BackendError> {
            Ok(AgentMessageData {
                id: "backend-msg".into(),
                role: "assistant".into(),
                content: "hello from backend".into(),
                timestamp: timestamp.into(),
                metadata: Some(metadata),
                form_message: None,
            })
        }
    }

    #[tokio::test]
    async fn set_backend_allows_custom_backend() {
        let service = AgentService::new();
        let session_service = SessionService::new_in_memory();
        let (bridge, info) = test_wallet_bridge();
        service
            .initialize(sample_config(), bridge, info)
            .await
            .unwrap();

        let status = service.status().await;
        let session_id = status.session_id.clone().unwrap();

        let now = Utc::now().to_rfc3339();
        session_service
            .save_session(ChatSession {
                id: session_id.clone(),
                name: "Custom".into(),
                mode: "personal".into(),
                topic_id: None,
                created_at: now.clone(),
                updated_at: now,
                last_message_at: None,
                is_active: true,
                messages: vec![],
            })
            .await
            .unwrap();

        service.set_backend(Arc::new(RecordingBackend)).await;

        let result = service
            .send_message(
                &session_service,
                AgentMessageRequest {
                    session_id: Some(session_id.clone()),
                    content: "from test".into(),
                    chat_history: None,
                    attachments: None,
                    form_submission: None,
                },
            )
            .await
            .unwrap();

        let response = result.response.expect("response");
        assert_eq!(response.id, "backend-msg");
        assert_eq!(response.content, "hello from backend");
    }

    struct FormEchoBackend;

    #[async_trait]
    impl AgentBackend for FormEchoBackend {
        async fn send_message(
            &self,
            _request: &AgentMessageRequest,
            _metadata: Value,
            timestamp: &str,
        ) -> Result<AgentMessageData, BackendError> {
            Ok(AgentMessageData {
                id: format!("msg-{}", Uuid::new_v4()),
                role: "assistant".into(),
                content: "Form required".into(),
                timestamp: timestamp.into(),
                metadata: Some(json!({
                    "formMessage": {
                        "id": "form-inscribe",
                        "toolName": "inscribeHashinal",
                        "formConfig": {
                            "title": "Inscribe Hashinal",
                            "fields": [],
                        }
                    }
                })),
                form_message: Some(json!({
                    "id": "form-inscribe",
                    "toolName": "inscribeHashinal",
                    "formConfig": {
                        "title": "Inscribe Hashinal",
                        "fields": [],
                    }
                })),
            })
        }
    }

    #[tokio::test]
    async fn send_message_preserves_form_message_in_response() {
        let service = AgentService::new();
        let session_service = SessionService::new_in_memory();
        let (bridge, info) = test_wallet_bridge();
        service
            .initialize(sample_config(), bridge.clone(), Arc::clone(&info))
            .await
            .unwrap();

        let status = service.status().await;
        let session_id = status.session_id.clone().unwrap();

        let now = Utc::now().to_rfc3339();
        session_service
            .save_session(ChatSession {
                id: session_id.clone(),
                name: "Form Session".into(),
                mode: "personal".into(),
                topic_id: None,
                created_at: now.clone(),
                updated_at: now,
                last_message_at: None,
                is_active: true,
                messages: vec![],
            })
            .await
            .unwrap();

        service.set_backend(Arc::new(FormEchoBackend)).await;

        let result = service
            .send_message(
                &session_service,
                AgentMessageRequest {
                    session_id: Some(session_id),
                    content: "Please inscribe".into(),
                    chat_history: None,
                    attachments: None,
                    form_submission: None,
                },
            )
            .await
            .unwrap();

        assert!(result.success);
        let payload = result.response.expect("response payload");
        let form_message = payload
            .form_message
            .expect("form message should be present");
        assert_eq!(form_message["id"], json!("form-inscribe"));
        assert_eq!(form_message["toolName"], json!("inscribeHashinal"));
    }

    #[tokio::test]
    async fn update_session_context_stores_context() {
        let service = AgentService::new();
        let context = AgentSessionContext {
            session_id: "session-1".into(),
            mode: "hcs10".into(),
            topic_id: Some("topic".into()),
        };
        service.update_session_context(context.clone()).await;
        let stored = service.session_context().await.unwrap();
        assert_eq!(stored.mode, "hcs10");
        assert_eq!(stored.topic_id, Some("topic".into()));
    }

    #[tokio::test]
    async fn disconnect_resets_state() {
        let service = AgentService::new();
        let (bridge, info) = test_wallet_bridge();
        service
            .initialize(sample_config(), bridge, info)
            .await
            .unwrap();
        service
            .update_session_context(AgentSessionContext {
                session_id: "session".into(),
                mode: "personal".into(),
                topic_id: None,
            })
            .await;
        service.disconnect().await;
        let status = service.status().await;
        assert!(!status.connected);
        assert!(status.session_id.is_none());
        assert!(service.session_context().await.is_none());
    }
}
