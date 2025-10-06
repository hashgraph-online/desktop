use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::generic_array::GenericArray,
    aead::{Aead, NewAead},
};
use anyhow::{Result, anyhow};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use rand::RngCore;
use scrypt::{Params as ScryptParams, scrypt};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::{fs, io::AsyncWriteExt, sync::Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StoredCredential {
    pub service: String,
    pub account: String,
    pub encrypted_password: String,
    pub created_at: u64,
}

pub struct CredentialManager {
    path: PathBuf,
    master_password: String,
    lock: Arc<Mutex<()>>,
}

impl CredentialManager {
    pub fn new(path: PathBuf, master_password: impl Into<String>) -> Self {
        Self {
            path,
            master_password: master_password.into(),
            lock: Arc::new(Mutex::new(())),
        }
    }

    pub async fn store(&self, service: &str, account: &str, password: &str) -> Result<bool> {
        if service.trim().is_empty() || account.trim().is_empty() {
            return Err(anyhow!("service and account must not be empty"));
        }

        let _guard = self.lock.lock().await;
        let mut credentials = self.load_credentials().await?;
        let encrypted_password = self.encrypt_password(password)?;

        credentials.retain(|item| !(item.service == service && item.account == account));
        credentials.push(StoredCredential {
            service: service.to_owned(),
            account: account.to_owned(),
            encrypted_password,
            created_at: chrono::Utc::now().timestamp_millis() as u64,
        });

        self.save_credentials(&credentials).await?;
        Ok(true)
    }

    pub async fn get(&self, service: &str, account: &str) -> Result<Option<String>> {
        if service.trim().is_empty() || account.trim().is_empty() {
            return Err(anyhow!("service and account must not be empty"));
        }

        let _guard = self.lock.lock().await;
        let credentials = self.load_credentials().await?;
        if let Some(credential) = credentials
            .into_iter()
            .find(|item| item.service == service && item.account == account)
        {
            return Ok(Some(self.decrypt_password(&credential.encrypted_password)?));
        }

        Ok(None)
    }

    pub async fn delete(&self, service: &str, account: &str) -> Result<bool> {
        if service.trim().is_empty() || account.trim().is_empty() {
            return Err(anyhow!("service and account must not be empty"));
        }

        let mut credentials = self.load_credentials().await?;
        let original_len = credentials.len();
        credentials.retain(|item| !(item.service == service && item.account == account));

        if credentials.len() == original_len {
            return Ok(false);
        }

        self.save_credentials(&credentials).await?;
        Ok(true)
    }

    pub async fn clear(&self, service: &str) -> Result<u32> {
        if service.trim().is_empty() {
            return Err(anyhow!("service must not be empty"));
        }

        let _guard = self.lock.lock().await;
        let mut credentials = self.load_credentials().await?;
        let removed = credentials
            .iter()
            .filter(|item| item.service == service)
            .count() as u32;

        if removed == 0 {
            return Ok(0);
        }

        credentials.retain(|item| item.service != service);
        self.save_credentials(&credentials).await?;
        Ok(removed)
    }

    async fn load_credentials(&self) -> Result<Vec<StoredCredential>> {
        let data = match fs::read(&self.path).await {
            Ok(data) => data,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(anyhow!(error)),
        };
        let decrypted = self.decrypt_password_bytes(&data)?;
        let credentials: Vec<StoredCredential> = serde_json::from_slice(&decrypted)?;
        Ok(credentials)
    }

    async fn save_credentials(&self, credentials: &[StoredCredential]) -> Result<()> {
        let serialized = serde_json::to_vec(credentials)?;
        let encrypted = self.encrypt_password_bytes(&serialized)?;
        let mut file = fs::File::create(&self.path).await?;
        file.write_all(&encrypted).await?;
        file.flush().await?;
        Ok(())
    }

    fn encrypt_password(&self, password: &str) -> Result<String> {
        let encrypted = self.encrypt_password_bytes(password.as_bytes())?;
        Ok(STANDARD.encode(encrypted))
    }

    fn encrypt_password_bytes(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let mut salt = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut salt);

        let key = self.derive_key(&salt)?;
        let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher.encrypt(nonce, plaintext)?;

        let mut combined = Vec::with_capacity(salt.len() + nonce_bytes.len() + ciphertext.len());
        combined.extend_from_slice(&salt);
        combined.extend_from_slice(&nonce_bytes);
        combined.extend_from_slice(&ciphertext);
        Ok(combined)
    }

    fn decrypt_password(&self, encrypted: &str) -> Result<String> {
        let decoded = STANDARD.decode(encrypted)?;
        let decrypted = self.decrypt_password_bytes(&decoded)?;
        Ok(String::from_utf8(decrypted)?)
    }

    fn decrypt_password_bytes(&self, combined: &[u8]) -> Result<Vec<u8>> {
        if combined.len() < 32 + 12 {
            return Err(anyhow!("encrypted payload too short"));
        }

        let (salt, rest) = combined.split_at(32);
        let (nonce_bytes, ciphertext) = rest.split_at(12);

        let key = self.derive_key(salt)?;
        let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));
        let nonce = Nonce::from_slice(nonce_bytes);
        let plaintext = cipher.decrypt(nonce, ciphertext)?;
        Ok(plaintext)
    }

    fn derive_key(&self, salt: &[u8]) -> Result<Vec<u8>> {
        let params = ScryptParams::new(15, 8, 1, 32)?;
        let mut key = vec![0u8; 32];
        scrypt(self.master_password.as_bytes(), salt, &params, &mut key)?;
        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn storing_and_retrieving_password_round_trips() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("credentials.dat");
        let manager = CredentialManager::new(path, "master-secret");

        manager
            .store("service", "account", "super-secret")
            .await
            .unwrap();

        let retrieved = manager.get("service", "account").await.unwrap();
        assert_eq!(retrieved, Some("super-secret".to_string()));
    }

    #[tokio::test]
    async fn delete_removes_entry() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("credentials.dat");
        let manager = CredentialManager::new(path, "master-secret");

        manager
            .store("service", "account", "super-secret")
            .await
            .unwrap();

        let deleted = manager.delete("service", "account").await.unwrap();
        assert!(deleted);

        let retrieved = manager.get("service", "account").await.unwrap();
        assert_eq!(retrieved, None);
    }

    #[tokio::test]
    async fn clear_removes_all_for_service() {
        let temp = tempdir().unwrap();
        let path = temp.path().join("credentials.dat");
        let manager = CredentialManager::new(path, "master-secret");

        manager
            .store("service", "account1", "secret1")
            .await
            .unwrap();
        manager
            .store("service", "account2", "secret2")
            .await
            .unwrap();
        manager.store("other", "account", "secret3").await.unwrap();

        let cleared = manager.clear("service").await.unwrap();
        assert_eq!(cleared, 2);

        assert_eq!(manager.get("service", "account1").await.unwrap(), None);
        assert_eq!(manager.get("service", "account2").await.unwrap(), None);
        assert_eq!(
            manager.get("other", "account").await.unwrap(),
            Some("secret3".to_string())
        );
    }
}
