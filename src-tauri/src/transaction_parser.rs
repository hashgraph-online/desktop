use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

#[derive(Clone)]
pub struct TransactionParserBridge {
    script_path: PathBuf,
}

impl TransactionParserBridge {
    pub fn new(script_path: PathBuf) -> Self {
        Self { script_path }
    }

    pub async fn validate(&self, transaction_bytes: &str) -> Result<Value, String> {
        let payload = json!({ "transactionBytes": transaction_bytes });
        self.request("transaction_parser_validate", payload).await
    }

    pub async fn parse(&self, transaction_bytes: &str) -> Result<Value, String> {
        let payload = json!({ "transactionBytes": transaction_bytes });
        self.request("transaction_parser_parse", payload).await
    }

    async fn request(&self, action: &str, payload: Value) -> Result<Value, String> {
        let mut command = Command::new("node");
        command.arg(&self.script_path);
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn transaction parser bridge: {error}"))?;

        let request = BridgeRequest {
            id: 1,
            action,
            payload,
        };

        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize transaction parser request: {error}"))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(serialized.as_bytes())
                .await
                .map_err(|error| format!("Failed to write transaction parser request: {error}"))?;
            stdin.write_all(b"\n").await.map_err(|error| {
                format!("Failed to finalize transaction parser request: {error}")
            })?;
        } else {
            return Err("Transaction parser bridge stdin unavailable".to_string());
        }

        let mut stdout_buffer = String::new();
        if let Some(mut stdout) = child.stdout.take() {
            stdout
                .read_to_string(&mut stdout_buffer)
                .await
                .map_err(|error| format!("Failed to read transaction parser response: {error}"))?;
        }

        let mut stderr_buffer = String::new();
        if let Some(mut stderr) = child.stderr.take() {
            let _ = stderr.read_to_string(&mut stderr_buffer).await;
        }

        let status = child
            .wait()
            .await
            .map_err(|error| format!("Transaction parser bridge process error: {error}"))?;

        if !status.success() {
            let trimmed = stderr_buffer.trim();
            if !trimmed.is_empty() {
                return Err(trimmed.to_string());
            }
            return Err(format!(
                "Transaction parser bridge exited with status {status}"
            ));
        }

        let trimmed = stdout_buffer.trim();
        if trimmed.is_empty() {
            return Ok(Value::Null);
        }

        let json_payload = extract_bridge_json(trimmed).ok_or_else(|| {
            format!(
                "Transaction parser bridge returned non-JSON output: {}",
                trimmed
            )
        })?;

        let response: BridgeResponse = serde_json::from_str(&json_payload)
            .map_err(|error| format!("Failed to parse transaction parser response: {error}"))?;

        if !response.success {
            return Err(response
                .error
                .unwrap_or_else(|| "Transaction parser bridge returned an error".to_string()));
        }

        Ok(response.data.unwrap_or(Value::Null))
    }
}

fn extract_bridge_json(payload: &str) -> Option<String> {
    for line in payload.lines().rev() {
        let candidate = line.trim();
        if candidate.starts_with('{') && candidate.ends_with('}') {
            return Some(candidate.to_string());
        }
    }

    let start = payload.find('{')?;
    let end = payload.rfind('}')?;
    if end >= start {
        Some(payload[start..=end].to_string())
    } else {
        None
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
    #[serde(default)]
    success: bool,
    #[serde(default)]
    data: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Clone, Default)]
pub struct TransactionParserState {
    bridge: Option<TransactionParserBridge>,
}

impl TransactionParserState {
    pub fn new(bridge: Option<TransactionParserBridge>) -> Self {
        Self { bridge }
    }

    pub fn bridge(&self) -> Option<TransactionParserBridge> {
        self.bridge.clone()
    }
}
