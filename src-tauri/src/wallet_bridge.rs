use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex, RwLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Event, EventId, Listener, Wry};
use tokio::sync::{Mutex, oneshot};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletBridgeInfo {
    pub account_id: String,
    pub network: String,
}

type PendingSender = oneshot::Sender<Result<Value, String>>;

type PendingMap = Arc<Mutex<HashMap<String, PendingSender>>>;

#[derive(Clone, Default)]
pub struct WalletBridgeState {
    app_handle: Arc<RwLock<Option<AppHandle<Wry>>>>,
    pending_inscriptions: PendingMap,
    pending_executions: PendingMap,
}

impl WalletBridgeState {
    pub fn set_app_handle(&self, handle: &AppHandle<Wry>) {
        let mut guard = self.app_handle.write().expect("wallet app handle poisoned");
        *guard = Some(handle.clone());
    }

    fn app_handle(&self) -> Result<AppHandle<Wry>, String> {
        self.app_handle
            .read()
            .expect("wallet app handle poisoned")
            .clone()
            .ok_or_else(|| "Desktop bridge is not ready".to_string())
    }

    fn register_reply_listener(
        &self,
        event_name: String,
        request_id: String,
        pending: PendingMap,
    ) -> Result<Arc<StdMutex<Option<EventId>>>, String> {
        let app = self.app_handle()?;
        let handler_slot = Arc::new(StdMutex::new(None::<EventId>));
        let handler_slot_clone = handler_slot.clone();
        let state_clone = self.clone();
        let request_id_clone = request_id.clone();
        let pending_clone = pending.clone();

        let handler_id = app.listen_any(event_name, move |event: Event| {
            let state_clone = state_clone.clone();
            let handler_slot_clone = handler_slot_clone.clone();
            let pending_clone_inner = pending_clone.clone();
            let request_id_for_async = request_id_clone.clone();
            let payload_result = serde_json::from_str::<BridgeReply>(event.payload())
                .map(|reply| reply.into_result())
                .unwrap_or_else(|_| Err("Malformed wallet reply payload".to_string()));

            tauri::async_runtime::spawn(async move {
                state_clone
                    .complete_request(&pending_clone_inner, &request_id_for_async, payload_result)
                    .await;

                if let Ok(Some(handler)) = handler_slot_clone
                    .lock()
                    .map(|mut slot: std::sync::MutexGuard<Option<EventId>>| slot.take())
                {
                    if let Ok(app) = state_clone.app_handle() {
                        app.unlisten(handler);
                    }
                }
            });
        });

        if let Ok(mut slot) = handler_slot.lock() {
            *slot = Some(handler_id);
        }

        Ok(handler_slot)
    }

    async fn complete_request(
        &self,
        pending: &PendingMap,
        request_id: &str,
        result: Result<Value, String>,
    ) {
        let sender = pending.lock().await.remove(request_id);
        if let Some(sender) = sender {
            let _ = sender.send(result);
        }
    }

    async fn await_response(
        &self,
        pending: PendingMap,
        request_id: String,
        timeout: Duration,
    ) -> Result<Value, String> {
        let receiver = {
            let mut map = pending.lock().await;
            let (tx, rx) = oneshot::channel();
            map.insert(request_id.clone(), tx);
            rx
        };

        match tokio::time::timeout(timeout, receiver).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("Wallet bridge receiver dropped".to_string()),
            Err(_) => {
                pending.lock().await.remove(&request_id);
                Err("Wallet bridge request timed out".to_string())
            }
        }
    }

    pub async fn start_inscription(
        &self,
        request: Value,
        network: String,
    ) -> Result<Value, String> {
        let app = self.app_handle()?;
        let request_id = Uuid::new_v4().to_string();
        let reply_event = format!("wallet_inscribe_start_reply_{request_id}");
        let handler_slot = self.register_reply_listener(
            reply_event,
            request_id.clone(),
            self.pending_inscriptions.clone(),
        )?;

        app.emit(
            "wallet_inscribe_start_request",
            json!({
                "requestId": request_id.clone(),
                "request": request,
                "network": network,
            }),
        )
        .map_err(|error: tauri::Error| error.to_string())?;

        let result = self
            .await_response(
                self.pending_inscriptions.clone(),
                request_id.clone(),
                Duration::from_secs(5 * 60),
            )
            .await;

        if let Ok(Some(handler)) = handler_slot
            .lock()
            .map(|mut slot: std::sync::MutexGuard<Option<EventId>>| slot.take())
        {
            if let Ok(app) = self.app_handle() {
                app.unlisten(handler);
            }
        }

        result
    }

    pub async fn execute_transaction(
        &self,
        base64: String,
        network: String,
    ) -> Result<Value, String> {
        let app = self.app_handle()?;
        let request_id = Uuid::new_v4().to_string();
        let reply_event = format!("wallet_execute_tx_reply_{request_id}");
        let handler_slot = self.register_reply_listener(
            reply_event,
            request_id.clone(),
            self.pending_executions.clone(),
        )?;

        app.emit(
            "wallet_execute_tx_request",
            json!({
                "requestId": request_id.clone(),
                "base64": base64,
                "network": network,
            }),
        )
        .map_err(|error: tauri::Error| error.to_string())?;

        let result = self
            .await_response(
                self.pending_executions.clone(),
                request_id.clone(),
                Duration::from_secs(2 * 60),
            )
            .await;

        if let Ok(Some(handler)) = handler_slot
            .lock()
            .map(|mut slot: std::sync::MutexGuard<Option<EventId>>| slot.take())
        {
            if let Ok(app) = self.app_handle() {
                app.unlisten(handler);
            }
        }

        result
    }

    pub async fn wallet_status(&self, info: &Arc<Mutex<Option<WalletBridgeInfo>>>) -> Value {
        let guard = info.lock().await;
        match guard.as_ref() {
            Some(info) => json!({
                "connected": true,
                "accountId": info.account_id,
                "network": info.network,
            }),
            None => json!({
                "connected": false,
            }),
        }
    }
}

#[derive(Deserialize)]
struct BridgeReply {
    success: bool,
    #[serde(default)]
    data: Option<Value>,
    #[serde(default)]
    error: Option<String>,
}

impl BridgeReply {
    fn into_result(self) -> Result<Value, String> {
        if self.success {
            Ok(self.data.unwrap_or(Value::Null))
        } else {
            Err(self
                .error
                .unwrap_or_else(|| "Unknown wallet error".to_string()))
        }
    }
}

pub async fn wallet_status_json(
    bridge: &WalletBridgeState,
    info: &Arc<Mutex<Option<WalletBridgeInfo>>>,
) -> Value {
    bridge.wallet_status(info).await
}

pub async fn wallet_execute_bytes(
    bridge: &WalletBridgeState,
    base64: String,
    network: String,
) -> Result<Value, String> {
    bridge.execute_transaction(base64, network).await
}

pub async fn wallet_start_inscription(
    bridge: &WalletBridgeState,
    request: Value,
    network: String,
) -> Result<Value, String> {
    bridge.start_inscription(request, network).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn wallet_status_defaults_to_disconnected() {
        let bridge = WalletBridgeState::default();
        let info = Arc::new(Mutex::new(None::<WalletBridgeInfo>));

        let status = wallet_status_json(&bridge, &info).await;

        assert_eq!(status.get("connected"), Some(&Value::Bool(false)));
    }

    #[tokio::test]
    async fn wallet_status_reflects_active_wallet() {
        let bridge = WalletBridgeState::default();
        let info = Arc::new(Mutex::new(Some(WalletBridgeInfo {
            account_id: "0.0.5005".to_string(),
            network: "testnet".to_string(),
        })));

        let status = wallet_status_json(&bridge, &info).await;

        assert_eq!(status.get("connected"), Some(&Value::Bool(true)));
        assert_eq!(
            status.get("accountId"),
            Some(&Value::String("0.0.5005".to_string()))
        );
        assert_eq!(
            status.get("network"),
            Some(&Value::String("testnet".to_string()))
        );
    }
}
