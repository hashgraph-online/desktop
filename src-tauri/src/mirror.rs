use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::Command;

#[derive(Clone)]
pub struct MirrorNodeBridge {
    script_path: PathBuf,
}

impl MirrorNodeBridge {
    pub fn new(script_path: PathBuf) -> Self {
        Self { script_path }
    }

    pub async fn get_schedule_info(
        &self,
        schedule_id: &str,
        network: MirrorNetwork,
    ) -> Result<Option<Value>, String> {
        let payload = json!({
            "scheduleId": schedule_id,
            "network": network.as_str(),
        });

        let data = self
            .request("mirror_node_get_schedule_info", payload)
            .await?;

        if data.is_null() {
            Ok(None)
        } else {
            Ok(Some(data))
        }
    }

    pub async fn get_scheduled_transaction_status(
        &self,
        schedule_id: &str,
        network: MirrorNetwork,
    ) -> Result<Value, String> {
        let payload = json!({
            "scheduleId": schedule_id,
            "network": network.as_str(),
        });

        self.request("mirror_node_get_scheduled_transaction_status", payload)
            .await
    }

    pub async fn get_transaction_by_timestamp(
        &self,
        timestamp: &str,
        network: MirrorNetwork,
    ) -> Result<Vec<Value>, String> {
        let payload = json!({
            "timestamp": timestamp,
            "network": network.as_str(),
        });

        let data = self
            .request("mirror_node_get_transaction_by_timestamp", payload)
            .await?;

        let transactions = data
            .get("transactions")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default();

        Ok(transactions)
    }

    pub async fn get_transaction(
        &self,
        transaction_id: &str,
        network: MirrorNetwork,
    ) -> Result<Option<Value>, String> {
        let payload = json!({
            "transactionId": transaction_id,
            "network": network.as_str(),
        });

        let data = self.request("mirror_node_get_transaction", payload).await?;

        if data.is_null() {
            return Ok(None);
        }

        let direct_transaction = data.get("transaction").cloned();
        if let Some(transaction) = direct_transaction {
            if !transaction.is_null() {
                return Ok(Some(transaction));
            }
        }

        let first_transaction = data
            .get("transactions")
            .and_then(|value| value.as_array())
            .and_then(|array| array.first().cloned());

        Ok(first_transaction)
    }

    pub async fn get_token_info(
        &self,
        token_id: &str,
        network: MirrorNetwork,
    ) -> Result<Option<Value>, String> {
        let payload = json!({
            "tokenId": token_id,
            "network": network.as_str(),
        });

        let data = self.request("mirror_node_get_token_info", payload).await?;

        if data.is_null() {
            Ok(None)
        } else {
            Ok(Some(data))
        }
    }

    async fn request(&self, action: &str, payload: Value) -> Result<Value, String> {
        let mut command = Command::new("node");
        command.arg(&self.script_path);
        command.stdin(std::process::Stdio::piped());
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn mirror node bridge: {error}"))?;

        let request = BridgeRequest {
            id: 1,
            action,
            payload,
        };

        let serialized = serde_json::to_string(&request)
            .map_err(|error| format!("Failed to serialize mirror node request: {error}"))?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Mirror node bridge stdin unavailable".to_string())?;

        stdin
            .write_all(serialized.as_bytes())
            .await
            .map_err(|error| format!("Failed to write to mirror node bridge: {error}"))?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|error| format!("Failed to finalize mirror node bridge request: {error}"))?;
        drop(stdin);

        let mut output = String::new();

        if let Some(mut stdout) = child.stdout.take() {
            stdout
                .read_to_string(&mut output)
                .await
                .map_err(|error| format!("Failed to read mirror node bridge response: {error}"))?;
        }

        let status = child
            .wait()
            .await
            .map_err(|error| format!("Mirror node bridge process error: {error}"))?;

        if !status.success() {
            return Err(format!("Mirror node bridge exited with status {status}"));
        }

        let trimmed = output.trim();
        if trimmed.is_empty() {
            return Ok(Value::Null);
        }

        let json_payload = extract_bridge_json(trimmed)
            .ok_or_else(|| format!("Mirror node bridge returned non-JSON output: {}", trimmed))?;

        let response: BridgeResponse = serde_json::from_str(&json_payload)
            .map_err(|error| format!("Failed to parse mirror node bridge response: {error}"))?;

        if !response.success {
            return Err(response
                .error
                .unwrap_or_else(|| "Mirror node bridge returned an error".to_string()));
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

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum MirrorNetwork {
    Testnet,
    Mainnet,
}

impl MirrorNetwork {
    pub fn try_from_str(value: Option<&str>) -> Result<Self, String> {
        match value.map(|value| value.to_ascii_lowercase()).as_deref() {
            Some("mainnet") => Ok(Self::Mainnet),
            Some("testnet") | None => Ok(Self::Testnet),
            Some(other) => Err(format!("Unsupported Hedera network: {other}")),
        }
    }

    fn as_str(&self) -> &str {
        match self {
            Self::Testnet => "testnet",
            Self::Mainnet => "mainnet",
        }
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
pub struct MirrorBridgeState {
    bridge: Option<MirrorNodeBridge>,
}

impl MirrorBridgeState {
    pub fn new(bridge: Option<MirrorNodeBridge>) -> Self {
        Self { bridge }
    }

    pub fn bridge(&self) -> Option<MirrorNodeBridge> {
        self.bridge.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_stub_script(body: &str) -> NamedTempFile {
        let mut file = NamedTempFile::new().expect("create temp script");
        file.write_all(body.as_bytes()).expect("write script");
        file
    }

    fn stub_bridge_script() -> NamedTempFile {
        write_stub_script(
            r#"const responses = {
  'mirror_node_get_schedule_info': { success: true, data: { schedule_id: '0.0.123' } },
  'mirror_node_get_scheduled_transaction_status': { success: true, data: { executed: true, deleted: false } },
  'mirror_node_get_transaction_by_timestamp': { success: true, data: { transactions: [{ id: 'tx-1' }] } },
  'mirror_node_get_transaction': { success: true, data: { transactions: [{ id: 'tx-2' }] } }
};

const chunks = [];

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  chunks.push(chunk);
});

process.stdin.on('end', () => {
  const input = chunks.join('');
  const request = JSON.parse(input.trim());
  const response = responses[request.action] ?? { success: false, error: 'unknown action' };
  process.stdout.write(JSON.stringify({ id: request.id ?? null, ...response }));
  process.exit(response.success ? 0 : 1);
});
"#,
        )
    }

    #[tokio::test]
    async fn failing_schedule_info_test() {
        let script = stub_bridge_script();
        let bridge = MirrorNodeBridge::new(script.path().to_path_buf());
        let result = bridge
            .get_schedule_info("0.0.123", MirrorNetwork::Testnet)
            .await
            .unwrap();

        assert_eq!(result.unwrap()["schedule_id"], json!("0.0.123"));
    }

    #[tokio::test]
    async fn transactions_by_timestamp_flow() {
        let script = stub_bridge_script();
        let bridge = MirrorNodeBridge::new(script.path().to_path_buf());
        let transactions = bridge
            .get_transaction_by_timestamp("1700000002.0", MirrorNetwork::Testnet)
            .await
            .unwrap();

        assert_eq!(transactions.len(), 1);
        assert_eq!(transactions[0]["id"], json!("tx-1"));
    }

    #[tokio::test]
    async fn transaction_lookup_returns_first_entry() {
        let script = stub_bridge_script();
        let bridge = MirrorNodeBridge::new(script.path().to_path_buf());
        let transaction = bridge
            .get_transaction("0.0.1-1700000002-000000000", MirrorNetwork::Testnet)
            .await
            .unwrap();

        assert_eq!(transaction.unwrap()["id"], json!("tx-2"));
    }
}
