use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::generic_array::GenericArray,
    aead::{Aead, NewAead},
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use log::LevelFilter;
use rand::{RngCore, rngs::OsRng};
use scrypt::{Params as ScryptParams, scrypt};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HederaConfig {
    pub account_id: String,
    pub private_key: String,
    pub network: Network,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwarmConfig {
    pub bee_api_url: String,
    pub bee_feed_pk: String,
    pub auto_assig_stamp: bool,
    pub deferred_upload_size_threshold_mb: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedConfig {
    pub theme: Theme,
    pub auto_start: bool,
    pub log_level: LogLevel,
    #[serde(default = "default_true")]
    pub web_browser_plugin_enabled: bool,
    #[serde(default = "default_true")]
    pub swarm_plugin_enabled: bool,
    #[serde(default)]
    pub operational_mode: OperationalMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegalAcceptanceConfig {
    pub terms_accepted: bool,
    pub privacy_accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terms_accepted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub privacy_accepted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredHcs10Profile {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub socials: Option<ProfileSocials>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee_configuration: Option<serde_json::Value>,
    pub registered_at: String,
    pub last_updated: String,
    pub status: ProfileStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSocials {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub github: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProfileStatus {
    Active,
    Inactive,
    Pending,
}

impl Default for ProfileStatus {
    fn default() -> Self {
        ProfileStatus::Active
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub hedera: HederaConfig,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm: Option<SwarmConfig>,
    pub openai: ProviderConfig,
    pub anthropic: ProviderConfig,
    pub advanced: AdvancedConfig,
    pub llm_provider: LlmProvider,
    #[serde(default)]
    pub autonomous_mode: bool,
    #[serde(default)]
    pub legal_acceptance: LegalAcceptanceConfig,
    #[serde(default)]
    pub hcs10_profiles: Vec<StoredHcs10Profile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationalMode {
    #[serde(rename = "autonomous")]
    Autonomous,
    #[serde(rename = "provideBytes")]
    ProvideBytes,
    #[serde(rename = "returnBytes")]
    ReturnBytes,
}

impl Default for OperationalMode {
    fn default() -> Self {
        OperationalMode::ProvideBytes
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::Light
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Mainnet,
    Testnet,
}

impl Default for Network {
    fn default() -> Self {
        Network::Testnet
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl From<LogLevel> for LevelFilter {
    fn from(value: LogLevel) -> Self {
        match value {
            LogLevel::Debug => LevelFilter::Debug,
            LogLevel::Info => LevelFilter::Info,
            LogLevel::Warn => LevelFilter::Warn,
            LogLevel::Error => LevelFilter::Error,
        }
    }
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Info
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    Openai,
    Anthropic,
}

impl Default for LlmProvider {
    fn default() -> Self {
        LlmProvider::Openai
    }
}

impl Default for HederaConfig {
    fn default() -> Self {
        Self {
            account_id: String::new(),
            private_key: String::new(),
            network: Network::Testnet,
        }
    }
}

impl Default for SwarmConfig {
    fn default() -> Self {
        Self {
            bee_api_url: String::new(),
            bee_feed_pk: String::new(),
            auto_assig_stamp: true,
            deferred_upload_size_threshold_mb: 5,
        }
    }
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: String::new(),
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            hedera: HederaConfig::default(),
            swarm: Some(SwarmConfig::default()),
            openai: ProviderConfig {
                model: "gpt-5".to_string(),
                ..ProviderConfig::default()
            },
            anthropic: ProviderConfig {
                model: "claude-3-7-sonnet-latest".to_string(),
                ..ProviderConfig::default()
            },
            advanced: AdvancedConfig {
                theme: Theme::Light,
                auto_start: false,
                log_level: LogLevel::Info,
                web_browser_plugin_enabled: true,
                swarm_plugin_enabled: true,
                operational_mode: OperationalMode::ProvideBytes,
            },
            llm_provider: LlmProvider::Openai,
            autonomous_mode: false,
            legal_acceptance: LegalAcceptanceConfig::default(),
            hcs10_profiles: Vec::new(),
        }
    }
}

pub struct ConfigState {
    pub cached: Mutex<Option<AppConfig>>,
    pub master_password: String,
}

impl ConfigState {
    pub fn new(master_password: String) -> Self {
        Self {
            cached: Mutex::new(None),
            master_password,
        }
    }
}

fn config_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let mut config_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|error| format!("Failed to create config directory: {error}"))?;
    }

    config_dir.push("config.json");
    log::info!("config_path resolved to {:?}", config_dir);
    Ok(config_dir)
}

fn read_config_from_disk(path: &PathBuf) -> Result<AppConfig, String> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let mut file =
        File::open(path).map_err(|error| format!("Failed to open config file: {error}"))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|error| format!("Failed to read config file: {error}"))?;

    if contents.trim().is_empty() {
        return Ok(AppConfig::default());
    }

    serde_json::from_str::<AppConfig>(&contents)
        .map_err(|error| format!("Failed to parse config: {error}"))
}

fn write_config_to_disk(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    let serialized = serde_json::to_string_pretty(config)
        .map_err(|error| format!("Failed to serialize config: {error}"))?;

    let tmp_path = path.with_extension("json.tmp");
    let mut file = File::create(&tmp_path)
        .map_err(|error| format!("Failed to create temp config file: {error}"))?;
    file.write_all(serialized.as_bytes())
        .map_err(|error| format!("Failed to write config file: {error}"))?;
    file.flush()
        .map_err(|error| format!("Failed to flush config file: {error}"))?;

    fs::rename(&tmp_path, path)
        .map_err(|error| format!("Failed to move config file into place: {error}"))?;

    Ok(())
}

const ENCRYPTED_PREFIX: &str = "ENC:";

fn encrypt_sensitive_fields(config: &mut AppConfig, master_password: &str) -> Result<(), String> {
    if let Some(encrypted) = encrypt_value(&config.hedera.private_key, master_password)? {
        config.hedera.private_key = encrypted;
    }

    if let Some(swarm) = config.swarm.as_mut()
        && let Some(encrypted) = encrypt_value(&swarm.bee_feed_pk, master_password)?
    {
        swarm.bee_feed_pk = encrypted;
    }

    if let Some(encrypted) = encrypt_value(&config.openai.api_key, master_password)? {
        config.openai.api_key = encrypted;
    }

    if let Some(encrypted) = encrypt_value(&config.anthropic.api_key, master_password)? {
        config.anthropic.api_key = encrypted;
    }

    Ok(())
}

fn decrypt_sensitive_fields(config: &mut AppConfig, master_password: &str) -> Result<(), String> {
    if let Some(decrypted) = decrypt_value(&config.hedera.private_key, master_password)? {
        config.hedera.private_key = decrypted;
    }

    if let Some(swarm) = config.swarm.as_mut()
        && let Some(decrypted) = decrypt_value(&swarm.bee_feed_pk, master_password)?
    {
        swarm.bee_feed_pk = decrypted;
    }

    if let Some(decrypted) = decrypt_value(&config.openai.api_key, master_password)? {
        config.openai.api_key = decrypted;
    }

    if let Some(decrypted) = decrypt_value(&config.anthropic.api_key, master_password)? {
        config.anthropic.api_key = decrypted;
    }

    Ok(())
}

fn encrypt_value(value: &str, master_password: &str) -> Result<Option<String>, String> {
    if value.trim().is_empty() || value.starts_with(ENCRYPTED_PREFIX) {
        return Ok(None);
    }

    let mut salt = [0u8; 32];
    OsRng.fill_bytes(&mut salt);

    let key = derive_key(master_password, &salt)?;
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, value.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut combined = Vec::with_capacity(salt.len() + nonce_bytes.len() + ciphertext.len());
    combined.extend_from_slice(&salt);
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(Some(format!(
        "{}{}",
        ENCRYPTED_PREFIX,
        STANDARD.encode(combined)
    )))
}

fn decrypt_value(value: &str, master_password: &str) -> Result<Option<String>, String> {
    if !value.starts_with(ENCRYPTED_PREFIX) {
        return Ok(None);
    }

    let encoded = &value[ENCRYPTED_PREFIX.len()..];
    let combined = STANDARD
        .decode(encoded)
        .map_err(|error| format!("Failed to decode encrypted value: {error}"))?;

    if combined.len() < 44 {
        return Err("Encrypted payload too short".to_string());
    }

    let (salt, rest) = combined.split_at(32);
    let (nonce_bytes, ciphertext) = rest.split_at(12);

    let key = derive_key(master_password, salt)?;
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Failed to decrypt value".to_string())?;

    let decrypted = String::from_utf8(plaintext)
        .map_err(|error| format!("Decrypted value is not valid UTF-8: {error}"))?;
    Ok(Some(decrypted))
}

fn derive_key(master_password: &str, salt: &[u8]) -> Result<Vec<u8>, String> {
    let mut key = vec![0u8; 32];
    let params = ScryptParams::new(15, 8, 1, 32)
        .map_err(|error| format!("Failed to configure key derivation parameters: {error}"))?;
    scrypt(master_password.as_bytes(), salt, &params, &mut key)
        .map_err(|error| format!("Failed to derive encryption key: {error}"))?;
    Ok(key)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadConfigResponse {
    pub success: bool,
    pub config: AppConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginToggleResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub fn load_config(
    app_handle: AppHandle,
    state: State<ConfigState>,
) -> Result<LoadConfigResponse, String> {
    let path = config_path(&app_handle)?;

    let mut guard = state
        .cached
        .lock()
        .map_err(|error| format!("Failed to lock config cache: {error}"))?;

    if let Some(config) = guard.clone() {
        return Ok(LoadConfigResponse {
            success: true,
            config,
        });
    }

    let mut config = read_config_from_disk(&path)?;
    decrypt_sensitive_fields(&mut config, &state.master_password)?;
    *guard = Some(config.clone());
    Ok(LoadConfigResponse {
        success: true,
        config,
    })
}

#[tauri::command]
pub fn save_config(
    app_handle: AppHandle,
    state: State<ConfigState>,
    config: AppConfig,
) -> Result<(), String> {
    log::info!(
        "save_config invoked (openai key len: {}, anthropic key len: {})",
        config.openai.api_key.len(),
        config.anthropic.api_key.len()
    );

    let path = config_path(&app_handle)?;

    let mut sanitized = config.clone();

    {
        let guard = state
            .cached
            .lock()
            .map_err(|error| format!("Failed to lock config cache: {error}"))?;

        if sanitized.openai.api_key.trim().is_empty() {
            if let Some(previous) = guard.as_ref() {
                if !previous.openai.api_key.trim().is_empty() {
                    log::warn!("save_config: openai key empty, preserving cached value");
                    sanitized.openai.api_key = previous.openai.api_key.clone();
                }
            }
        }

        if sanitized.anthropic.api_key.trim().is_empty() {
            if let Some(previous) = guard.as_ref() {
                if !previous.anthropic.api_key.trim().is_empty() {
                    log::warn!("save_config: anthropic key empty, preserving cached value");
                    sanitized.anthropic.api_key = previous.anthropic.api_key.clone();
                }
            }
        }
    }

    let mut persisted = sanitized.clone();

    encrypt_sensitive_fields(&mut persisted, &state.master_password)?;
    log::info!(
        "persisted openai key prefix {:?}",
        persisted.openai.api_key.chars().take(4).collect::<String>()
    );
    write_config_to_disk(&path, &persisted)?;

    let mut guard = state
        .cached
        .lock()
        .map_err(|error| format!("Failed to lock config cache: {error}"))?;
    *guard = Some(sanitized);

    Ok(())
}

fn update_plugin_state(
    app_handle: &AppHandle,
    state: &State<ConfigState>,
    plugin_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let response = load_config(app_handle.clone(), state.clone())?;
    let mut config = response.config;

    let current_enabled = match plugin_id {
        "web-browser" => config.advanced.web_browser_plugin_enabled,
        "swarm" => config.advanced.swarm_plugin_enabled,
        _ => return Err(format!("Unknown plugin: {}", plugin_id)),
    };

    if current_enabled == enabled {
        return Ok(());
    }

    match plugin_id {
        "web-browser" => config.advanced.web_browser_plugin_enabled = enabled,
        "swarm" => config.advanced.swarm_plugin_enabled = enabled,
        _ => unreachable!(), // Safe due to prior validation
    }

    save_config(app_handle.clone(), state.clone(), config)?;
    Ok(())
}

#[tauri::command]
pub fn plugin_enable(
    app_handle: AppHandle,
    state: State<ConfigState>,
    plugin_id: String,
) -> Result<PluginToggleResponse, String> {
    if !["web-browser", "swarm"].contains(&plugin_id.as_str()) {
        return Ok(PluginToggleResponse {
            success: false,
            data: None,
            error: Some(format!("Unknown plugin: {plugin_id}")),
        });
    }

    update_plugin_state(&app_handle, &state, &plugin_id, true)?;
    Ok(PluginToggleResponse {
        success: true,
        data: None,
        error: None,
    })
}

#[tauri::command]
pub fn plugin_disable(
    app_handle: AppHandle,
    state: State<ConfigState>,
    plugin_id: String,
) -> Result<PluginToggleResponse, String> {
    if !["web-browser", "swarm"].contains(&plugin_id.as_str()) {
        return Ok(PluginToggleResponse {
            success: false,
            data: None,
            error: Some(format!("Unknown plugin: {plugin_id}")),
        });
    }

    update_plugin_state(&app_handle, &state, &plugin_id, false)?;
    Ok(PluginToggleResponse {
        success: true,
        data: None,
        error: None,
    })
}

#[tauri::command]
pub fn set_theme(state: State<ConfigState>, theme: Theme) -> Result<(), String> {
    let mut guard = state
        .cached
        .lock()
        .map_err(|error| format!("Failed to lock config cache: {error}"))?;

    if let Some(ref mut config) = *guard {
        config.advanced.theme = theme;
    }

    Ok(())
}

#[tauri::command]
pub fn set_auto_start(
    app_handle: AppHandle,
    state: State<ConfigState>,
    auto_start: bool,
) -> Result<(), String> {
    let autolaunch = app_handle.autolaunch();
    if auto_start {
        autolaunch.enable().map_err(|error| error.to_string())?;
    } else {
        autolaunch.disable().map_err(|error| error.to_string())?;
    }

    let mut guard = state
        .cached
        .lock()
        .map_err(|error| format!("Failed to lock config cache: {error}"))?;

    if guard.is_none() {
        *guard = Some(AppConfig::default());
    }

    if let Some(ref mut config) = *guard {
        config.advanced.auto_start = auto_start;
    }

    Ok(())
}

#[tauri::command]
pub fn set_log_level(state: State<ConfigState>, log_level: LogLevel) -> Result<(), String> {
    let level_filter: LevelFilter = log_level.clone().into();
    let mut guard = state
        .cached
        .lock()
        .map_err(|error| format!("Failed to lock config cache: {error}"))?;

    if let Some(ref mut config) = *guard {
        config.advanced.log_level = log_level;
    }

    crate::logging::set_level(level_filter);

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentConfig {
    pub enable_mainnet: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hedera: Option<HederaEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm: Option<SwarmEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai: Option<ProviderEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<ProviderEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_provider: Option<LlmProvider>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet_connect: Option<WalletConnectEnvironment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legal: Option<LegalEnvironment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HederaEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<Network>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SwarmEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bee_api_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bee_feed_pk: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_assig_stamp: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deferred_upload_size_threshold_mb: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletConnectEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LegalEnvironment {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terms_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub privacy_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terms_markdown: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub privacy_markdown: Option<String>,
}

#[tauri::command]
pub fn get_environment_config() -> Result<EnvironmentConfig, String> {
    let mut env_config = EnvironmentConfig {
        enable_mainnet: std::env::var("ENABLE_MAINNET")
            .map(|value| value == "true")
            .unwrap_or(false),
        ..EnvironmentConfig::default()
    };

    let hedera_account = std::env::var("HEDERA_OPERATOR_ID").ok();
    let hedera_key = std::env::var("HEDERA_OPERATOR_KEY").ok();
    let hedera_network = std::env::var("HEDERA_NETWORK").ok().and_then(|value| {
        match value.to_lowercase().as_str() {
            "mainnet" => Some(Network::Mainnet),
            "testnet" => Some(Network::Testnet),
            _ => None,
        }
    });

    if hedera_account.is_some() || hedera_key.is_some() || hedera_network.is_some() {
        env_config.hedera = Some(HederaEnvironment {
            account_id: hedera_account,
            private_key: hedera_key,
            network: hedera_network,
        });
    }
    
    let swarm_bee_api_url = std::env::var("SWARM_BEE_API_URL").ok();
    let swarm_bee_feed_pk = std::env::var("SWARM_BEE_FEED_PK").ok();
    let swarm_auto_assign_stamp = std::env::var("SWARM_AUTO_ASSIGN_STAMP")
        .ok()
        .and_then(|v| v.parse().ok());
    let swarm_threshold_mb = std::env::var("SWARM_DEFERRED_UPLOAD_SIZE_THRESHOLD_MB")
        .ok()
        .and_then(|v| v.parse().ok());

    if swarm_bee_api_url.is_some() || swarm_bee_feed_pk.is_some() || 
    swarm_auto_assign_stamp.is_some() || swarm_threshold_mb.is_some() {
        env_config.swarm = Some(SwarmEnvironment {
            bee_api_url: swarm_bee_api_url,
            bee_feed_pk: swarm_bee_feed_pk,
            auto_assig_stamp: swarm_auto_assign_stamp,
            deferred_upload_size_threshold_mb: swarm_threshold_mb,
        });
    }
    
    let openai_api_key = std::env::var("OPENAI_API_KEY").ok();
    let openai_model = std::env::var("OPENAI_MODEL").ok();
    if openai_api_key.is_some() || openai_model.is_some() {
        env_config.openai = Some(ProviderEnvironment {
            api_key: openai_api_key,
            model: openai_model.or_else(|| Some("gpt-4o-mini".into())),
        });
    }

    let anthropic_api_key = std::env::var("ANTHROPIC_API_KEY").ok();
    let anthropic_model = std::env::var("ANTHROPIC_MODEL").ok();
    if anthropic_api_key.is_some() || anthropic_model.is_some() {
        env_config.anthropic = Some(ProviderEnvironment {
            api_key: anthropic_api_key,
            model: anthropic_model.or_else(|| Some("claude-3-7-sonnet-latest".into())),
        });
    }

    let llm_provider =
        std::env::var("LLM_PROVIDER")
            .ok()
            .and_then(|value| match value.to_lowercase().as_str() {
                "openai" => Some(LlmProvider::Openai),
                "anthropic" => Some(LlmProvider::Anthropic),
                _ => None,
            });

    if llm_provider.is_some() {
        env_config.llm_provider = llm_provider;
    } else if env_config.anthropic.is_some() && env_config.openai.is_none() {
        env_config.llm_provider = Some(LlmProvider::Anthropic);
    } else if env_config.openai.is_some() && env_config.anthropic.is_none() {
        env_config.llm_provider = Some(LlmProvider::Openai);
    }

    if let Ok(project_id) = std::env::var("WALLETCONNECT_PROJECT_ID") {
        let wallet_env = WalletConnectEnvironment {
            project_id: Some(project_id),
            app_name: std::env::var("WALLET_APP_NAME").ok(),
            app_url: std::env::var("WALLET_APP_URL").ok(),
            app_icon: std::env::var("WALLET_APP_ICON").ok(),
        };
        env_config.wallet_connect = Some(wallet_env);
    }

    let mut legal_env = LegalEnvironment::default();

    match std::env::var("TERMS_MARKDOWN") {
        Ok(value) if !value.trim().is_empty() => {
            legal_env.terms_markdown = Some(value);
            legal_env.terms_source = Some("env:TERMS_MARKDOWN".to_string());
        }
        _ => {
            if let Ok(path_value) = std::env::var("TERMS_MARKDOWN_PATH") {
                let trimmed = path_value.trim();
                if !trimmed.is_empty() {
                    let resolved = PathBuf::from(trimmed);
                    match fs::read_to_string(&resolved) {
                        Ok(content) => {
                            legal_env.terms_markdown = Some(content);
                            legal_env.terms_source = Some(resolved.display().to_string());
                        }
                        Err(error) => {
                            log::warn!(
                                "Failed to read TERMS markdown from {}: {}",
                                resolved.display(),
                                error
                            );
                        }
                    }
                }
            }
        }
    }

    match std::env::var("PRIVACY_MARKDOWN") {
        Ok(value) if !value.trim().is_empty() => {
            legal_env.privacy_markdown = Some(value);
            legal_env.privacy_source = Some("env:PRIVACY_MARKDOWN".to_string());
        }
        _ => {
            if let Ok(path_value) = std::env::var("PRIVACY_MARKDOWN_PATH") {
                let trimmed = path_value.trim();
                if !trimmed.is_empty() {
                    let resolved = PathBuf::from(trimmed);
                    match fs::read_to_string(&resolved) {
                        Ok(content) => {
                            legal_env.privacy_markdown = Some(content);
                            legal_env.privacy_source = Some(resolved.display().to_string());
                        }
                        Err(error) => {
                            log::warn!(
                                "Failed to read PRIVACY markdown from {}: {}",
                                resolved.display(),
                                error
                            );
                        }
                    }
                }
            }
        }
    }

    if legal_env.terms_markdown.is_some() || legal_env.privacy_markdown.is_some() {
        env_config.legal = Some(legal_env);
    }

    Ok(env_config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn restore_env(key: &str, original: Option<String>) {
        if let Some(value) = original {
            unsafe {
                env::set_var(key, value);
            }
        } else {
            unsafe {
                env::remove_var(key);
            }
        }
    }

    #[test]
    fn read_config_returns_default_when_missing() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let path = temp_dir.path().join("config.json");

        let result = super::read_config_from_disk(&path).expect("read should succeed");

        assert_eq!(result.hedera.account_id, "");
        assert!(matches!(result.hedera.network, Network::Testnet));
        assert_eq!(result.openai.model, "gpt-4o");
        assert!(matches!(result.advanced.log_level, LogLevel::Info));
    }

    #[test]
    fn write_config_persists_and_reads_back() {
        let temp_dir = tempfile::tempdir().expect("tempdir");
        let path = temp_dir.path().join("config.json");

        let mut config = AppConfig::default();
        config.hedera.account_id = "0.0.1234".into();
        config.hedera.network = Network::Mainnet;
        config.openai.api_key = "sk-test".into();
        config.advanced.theme = Theme::Dark;
        config.legal_acceptance.terms_accepted = true;

        super::write_config_to_disk(&path, &config).expect("write");

        let restored = super::read_config_from_disk(&path).expect("read");

        assert_eq!(restored.hedera.account_id, "0.0.1234");
        assert!(matches!(restored.hedera.network, Network::Mainnet));
        assert_eq!(restored.openai.api_key, "sk-test");
        assert!(matches!(restored.advanced.theme, Theme::Dark));
        assert!(restored.legal_acceptance.terms_accepted);
    }

    #[test]
    fn environment_config_reflects_env_vars() {
        let original_id = env::var("HEDERA_OPERATOR_ID").ok();
        let original_key = env::var("HEDERA_OPERATOR_KEY").ok();
        let original_network = env::var("HEDERA_NETWORK").ok();
        let original_wc = env::var("WALLETCONNECT_PROJECT_ID").ok();

        unsafe {
            env::set_var("HEDERA_OPERATOR_ID", "0.0.999");
            env::set_var("HEDERA_OPERATOR_KEY", "priv-key");
            env::set_var("HEDERA_NETWORK", "mainnet");
            env::set_var("WALLETCONNECT_PROJECT_ID", "proj-123");
        }

        let config = get_environment_config().expect("env config");

        let hedera = config.hedera.expect("hedera env");
        assert_eq!(hedera.account_id.as_deref(), Some("0.0.999"));
        assert_eq!(hedera.private_key.as_deref(), Some("priv-key"));
        assert!(matches!(hedera.network, Some(Network::Mainnet)));

        let wallet = config.wallet_connect.expect("wallet env");
        assert_eq!(wallet.project_id.as_deref(), Some("proj-123"));

        restore_env("HEDERA_OPERATOR_ID", original_id);
        restore_env("HEDERA_OPERATOR_KEY", original_key);
        restore_env("HEDERA_NETWORK", original_network);
        restore_env("WALLETCONNECT_PROJECT_ID", original_wc);
    }

    #[test]
    fn environment_config_includes_legal_markdown() {
        let original_terms = env::var("TERMS_MARKDOWN").ok();
        let original_terms_path = env::var("TERMS_MARKDOWN_PATH").ok();
        let original_privacy = env::var("PRIVACY_MARKDOWN").ok();
        let original_privacy_path = env::var("PRIVACY_MARKDOWN_PATH").ok();

        unsafe {
            env::set_var("TERMS_MARKDOWN", "# Terms from env\nTest content");
        }

        let privacy_file = tempfile::NamedTempFile::new().expect("temp file");
        std::fs::write(privacy_file.path(), "# Privacy file\nDetails").expect("write privacy file");

        unsafe {
            env::set_var(
                "PRIVACY_MARKDOWN_PATH",
                privacy_file.path().to_str().expect("path str"),
            );
        }

        let config = get_environment_config().expect("env config");

        let legal = config.legal.expect("legal env");
        assert_eq!(
            legal.terms_markdown.as_deref(),
            Some("# Terms from env\nTest content")
        );
        assert_eq!(legal.terms_source.as_deref(), Some("env:TERMS_MARKDOWN"));
        let expected_privacy_path = privacy_file.path().display().to_string();
        assert_eq!(
            legal.privacy_markdown.as_deref(),
            Some("# Privacy file\nDetails")
        );
        assert_eq!(
            legal.privacy_source.as_deref(),
            Some(expected_privacy_path.as_str())
        );

        restore_env("TERMS_MARKDOWN", original_terms);
        restore_env("TERMS_MARKDOWN_PATH", original_terms_path);
        restore_env("PRIVACY_MARKDOWN", original_privacy);
        restore_env("PRIVACY_MARKDOWN_PATH", original_privacy_path);
    }

    #[test]
    fn encrypt_and_decrypt_sensitive_fields_round_trip() {
        let mut config = AppConfig::default();
        config.hedera.private_key = "test-private-key".into();
        config.openai.api_key = "sk-test-1234567890".into();
        config.anthropic.api_key = "sk-ant-test-1234567890".into();

        encrypt_sensitive_fields(&mut config, "master-secret").expect("encrypt");
        assert!(config.hedera.private_key.starts_with(ENCRYPTED_PREFIX));
        assert!(config.openai.api_key.starts_with(ENCRYPTED_PREFIX));
        assert!(config.anthropic.api_key.starts_with(ENCRYPTED_PREFIX));

        decrypt_sensitive_fields(&mut config, "master-secret").expect("decrypt");
        assert_eq!(config.hedera.private_key, "test-private-key");
        assert_eq!(config.openai.api_key, "sk-test-1234567890");
        assert_eq!(config.anthropic.api_key, "sk-ant-test-1234567890");
    }
}
