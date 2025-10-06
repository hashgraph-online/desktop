use async_trait::async_trait;

use crate::agent::{AgentMessageData, AgentMessageRequest};
use serde_json::Value;
use uuid::Uuid;

#[async_trait]
pub trait AgentBackend {
    async fn send_message(
        &self,
        request: &AgentMessageRequest,
        metadata: Value,
        timestamp: &str,
    ) -> Result<AgentMessageData, BackendError>;

    async fn disconnect(&self) -> Result<(), BackendError> {
        Ok(())
    }
}

pub struct EchoAgent;

impl EchoAgent {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl AgentBackend for EchoAgent {
    async fn send_message(
        &self,
        request: &AgentMessageRequest,
        metadata: Value,
        timestamp: &str,
    ) -> Result<AgentMessageData, BackendError> {
        Ok(AgentMessageData {
            id: format!("msg-{}", Uuid::new_v4()),
            role: "assistant".to_string(),
            content: format!("Echo: {}", request.content),
            timestamp: timestamp.to_string(),
            metadata: Some(metadata),
            form_message: None,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BackendError {
    #[error("agent backend failure: {0}")]
    Failure(String),
}

impl From<anyhow::Error> for BackendError {
    fn from(error: anyhow::Error) -> Self {
        Self::Failure(error.to_string())
    }
}
