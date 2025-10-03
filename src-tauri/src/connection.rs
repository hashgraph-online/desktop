use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct HederaMirrorConfig {
    pub mainnet: String,
    pub testnet: String,
}

impl Default for HederaMirrorConfig {
    fn default() -> Self {
        Self {
            mainnet: "https://mainnet.mirrornode.hedera.com/api/v1".to_string(),
            testnet: "https://testnet.mirrornode.hedera.com/api/v1".to_string(),
        }
    }
}

#[derive(Clone)]
pub struct ConnectionService {
    client: Client,
    mirror_config: HederaMirrorConfig,
}

impl ConnectionService {
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .user_agent("hol-desktop-tauri/0.0.1")
            .build()?;
        Ok(Self {
            client,
            mirror_config: HederaMirrorConfig::default(),
        })
    }

    pub fn with_mirror_config(mirror_config: HederaMirrorConfig) -> Result<Self> {
        let client = Client::builder()
            .user_agent("hol-desktop-tauri/0.0.1")
            .build()?;
        Ok(Self {
            client,
            mirror_config,
        })
    }

    pub async fn test_hedera(&self, credentials: HederaCredentials) -> Result<HederaTestResponse> {
        if credentials.account_id.trim().is_empty() || credentials.private_key.trim().is_empty() {
            return Ok(HederaTestResponse {
                success: false,
                balance: None,
                error: Some("Account ID and private key are required".to_string()),
            });
        }

        if !is_valid_account_id(&credentials.account_id) {
            return Ok(HederaTestResponse {
                success: false,
                balance: None,
                error: Some("Account ID must match format shard.realm.num".to_string()),
            });
        }

        let base_url = match credentials.network {
            HederaNetwork::Mainnet => &self.mirror_config.mainnet,
            HederaNetwork::Testnet => &self.mirror_config.testnet,
        };

        let url = format!(
            "{}/accounts/{}",
            base_url.trim_end_matches('/'),
            credentials.account_id
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .with_context(|| format!("Failed to contact Hedera mirror node: {url}"))?;

        if !response.status().is_success() {
            return Ok(HederaTestResponse {
                success: false,
                balance: None,
                error: Some(
                    "Network error. Please check your connection and try again.".to_string(),
                ),
            });
        }

        let account: MirrorAccount = response
            .json()
            .await
            .with_context(|| "Failed to parse mirror node response")?;
        let balance_hbar = account.balance.balance as f64 / 100_000_000_f64;
        let balance_str = format!("{balance_hbar:.2} HBAR");

        Ok(HederaTestResponse {
            success: true,
            balance: Some(balance_str),
            error: None,
        })
    }

    pub async fn test_openai(&self, credentials: LlmCredentials) -> Result<LlmTestResponse> {
        if credentials.api_key.trim().is_empty() {
            return Ok(LlmTestResponse {
                success: false,
                error: Some("OpenAI API key is required".to_string()),
            });
        }

        if !credentials.api_key.starts_with("sk-") {
            return Ok(LlmTestResponse {
                success: false,
                error: Some("Invalid OpenAI API key format".to_string()),
            });
        }

        Ok(LlmTestResponse {
            success: true,
            error: None,
        })
    }

    pub async fn test_anthropic(&self, credentials: LlmCredentials) -> Result<LlmTestResponse> {
        if credentials.api_key.trim().is_empty() {
            return Ok(LlmTestResponse {
                success: false,
                error: Some("Anthropic API key is required".to_string()),
            });
        }

        if !credentials.api_key.starts_with("sk-ant-") {
            return Ok(LlmTestResponse {
                success: false,
                error: Some("Invalid Anthropic API key format".to_string()),
            });
        }

        Ok(LlmTestResponse {
            success: true,
            error: None,
        })
    }
}

#[derive(Deserialize)]
struct MirrorAccount {
    balance: MirrorAccountBalance,
}

#[derive(Deserialize)]
struct MirrorAccountBalance {
    balance: u64,
}

fn is_valid_account_id(account_id: &str) -> bool {
    let mut parts = account_id.split('.');
    if let (Some(shard), Some(realm), Some(num), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    {
        return shard.chars().all(|c| c.is_ascii_digit())
            && realm.chars().all(|c| c.is_ascii_digit())
            && num.chars().all(|c| c.is_ascii_digit());
    }
    false
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct HederaCredentials {
    pub account_id: String,
    pub private_key: String,
    pub network: HederaNetwork,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HederaNetwork {
    Mainnet,
    Testnet,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct HederaTestResponse {
    pub success: bool,
    pub balance: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct LlmCredentials {
    pub api_key: String,
    pub model: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct LlmTestResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::MockServer;

    #[tokio::test]
    async fn hedera_test_success_returns_balance() {
        let server = MockServer::start();
        let account_id = "0.0.1234";
        let mirror_config = HederaMirrorConfig {
            mainnet: server.url("/api/v1"),
            testnet: server.url("/api/v1"),
        };
        let service = ConnectionService::with_mirror_config(mirror_config).unwrap();

        server.mock(|when, then| {
            when.method("GET")
                .path(format!("/api/v1/accounts/{}", account_id));
            then.status(200).json_body(serde_json::json!({
                "balance": { "balance": 123000000 }
            }));
        });

        let result = service
            .test_hedera(HederaCredentials {
                account_id: account_id.to_string(),
                private_key: "test-key".to_string(),
                network: HederaNetwork::Testnet,
            })
            .await
            .unwrap();

        assert!(result.success);
        assert_eq!(result.balance, Some("1.23 HBAR".to_string()));
        assert!(result.error.is_none());
    }

    #[tokio::test]
    async fn hedera_test_invalid_account_returns_error() {
        let service = ConnectionService::new().unwrap();
        let result = service
            .test_hedera(HederaCredentials {
                account_id: "invalid".to_string(),
                private_key: "key".to_string(),
                network: HederaNetwork::Testnet,
            })
            .await
            .unwrap();

        assert!(!result.success);
        assert!(result.balance.is_none());
        assert!(
            result
                .error
                .as_deref()
                .unwrap()
                .contains("Account ID must match")
        );
    }

    #[tokio::test]
    async fn openai_test_rejects_invalid_key() {
        let service = ConnectionService::new().unwrap();
        let result = service
            .test_openai(LlmCredentials {
                api_key: "wrong".to_string(),
                model: "gpt".to_string(),
            })
            .await
            .unwrap();

        assert!(!result.success);
        assert!(
            result
                .error
                .as_deref()
                .unwrap()
                .contains("Invalid OpenAI API key")
        );
    }

    #[tokio::test]
    async fn anthropic_test_accepts_valid_key() {
        let service = ConnectionService::new().unwrap();
        let result = service
            .test_anthropic(LlmCredentials {
                api_key: "sk-ant-valid".to_string(),
                model: "claude".to_string(),
            })
            .await
            .unwrap();

        assert!(result.success);
        assert!(result.error.is_none());
    }
}
