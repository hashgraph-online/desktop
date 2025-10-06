use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use std::path::Path;
use tokio::sync::Mutex;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub name: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message_at: Option<String>,
    pub is_active: bool,
    #[serde(default)]
    pub messages: Vec<ChatMessage>,
}

#[derive(Clone, Debug)]
pub struct CreateSessionInput {
    pub name: String,
    pub mode: String,
    pub topic_id: Option<String>,
    pub is_active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionContext {
    pub session_id: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_id: Option<String>,
}

pub struct SessionService {
    db: Mutex<Connection>,
}

impl SessionService {
    pub fn from_path(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let connection = Connection::open(path).map_err(|err| err.to_string())?;
        Self::configure_connection(&connection)?;
        Ok(Self {
            db: Mutex::new(connection),
        })
    }

    #[cfg(test)]
    pub fn new_in_memory() -> Self {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        Self::configure_connection(&connection).expect("init schema");
        Self {
            db: Mutex::new(connection),
        }
    }

    fn configure_connection(connection: &Connection) -> Result<(), String> {
        connection
            .pragma_update(None, "foreign_keys", &"ON")
            .map_err(|err| err.to_string())?;
        connection
            .execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    topic_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_message_at TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS chat_session_contexts (
                    session_id TEXT PRIMARY KEY,
                    mode TEXT NOT NULL,
                    topic_id TEXT,
                    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    message_type TEXT,
                    metadata TEXT,
                    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp
                    ON chat_messages(session_id, timestamp);

                CREATE INDEX IF NOT EXISTS idx_chat_sessions_mode
                    ON chat_sessions(mode);

                CREATE INDEX IF NOT EXISTS idx_chat_sessions_topic
                    ON chat_sessions(topic_id);

                CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message
                    ON chat_sessions(last_message_at);

                CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
                    ON chat_sessions(is_active);

                CREATE INDEX IF NOT EXISTS idx_chat_sessions_mode_topic
                    ON chat_sessions(mode, topic_id);

                CREATE INDEX IF NOT EXISTS idx_chat_messages_type
                    ON chat_messages(message_type);
                "#,
            )
            .map_err(|err| err.to_string())?;
        Self::ensure_column(connection, "chat_sessions", "name", "TEXT");
        Self::ensure_column(connection, "chat_sessions", "last_message_at", "TEXT");
        Self::ensure_column(
            connection,
            "chat_sessions",
            "is_active",
            "INTEGER DEFAULT 1",
        );
        Self::ensure_column(connection, "chat_messages", "message_type", "TEXT");
        Ok(())
    }

    fn ensure_column(connection: &Connection, table: &str, column: &str, definition: &str) {
        let pragma = format!("PRAGMA table_info({table})");
        if let Ok(mut stmt) = connection.prepare(&pragma) {
            if let Ok(mut rows) = stmt.query([]) {
                while let Ok(Some(row)) = rows.next() {
                    let name: String = row.get(1).unwrap_or_default();
                    if name == column {
                        return;
                    }
                }
            }
        }
        let alter = format!("ALTER TABLE {table} ADD COLUMN {column} {definition}");
        let _ = connection.execute(&alter, []);
    }

    pub async fn create_session(&self, input: CreateSessionInput) -> ChatSession {
        let id = uuid::Uuid::new_v4().to_string();
        let now = current_timestamp();
        let CreateSessionInput {
            name,
            mode,
            topic_id,
            is_active,
        } = input;

        let session = ChatSession {
            id: id.clone(),
            name: name.clone(),
            mode: mode.clone(),
            topic_id: topic_id.clone(),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_message_at: None,
            is_active,
            messages: Vec::new(),
        };

        let connection = self.db.lock().await;
        connection
            .execute(
                "INSERT INTO chat_sessions (id, name, mode, topic_id, created_at, updated_at, last_message_at, is_active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    session.id,
                    name,
                    mode,
                    topic_id,
                    session.created_at,
                    session.updated_at,
                    session.last_message_at,
                    if session.is_active { 1 } else { 0 }
                ],
            )
            .expect("insert session");

        session
    }

    pub async fn load_session(&self, session_id: &str) -> Option<ChatSession> {
        let connection = self.db.lock().await;
        let session = Self::fetch_session(&connection, session_id)
            .ok()
            .flatten()?;
        Some(session)
    }

    pub async fn load_all_sessions(&self) -> Vec<ChatSession> {
        let connection = self.db.lock().await;
        let mut stmt = connection
            .prepare(
                "SELECT id, name, mode, topic_id, created_at, updated_at, last_message_at, is_active
                 FROM chat_sessions ORDER BY datetime(COALESCE(last_message_at, updated_at)) DESC",
            )
            .expect("prepare load sessions");

        let mut rows = stmt.query([]).expect("query sessions");
        let mut sessions = Vec::new();
        while let Some(row) = rows.next().expect("next row") {
            let base = Self::map_session_row(&connection, row).expect("map session");
            sessions.push(base);
        }
        sessions
    }

    pub async fn save_session(&self, session: ChatSession) -> Result<(), String> {
        if session.id.trim().is_empty() {
            return Err("Session ID is required".to_string());
        }

        let ChatSession {
            id,
            name,
            mode,
            topic_id,
            created_at,
            updated_at,
            last_message_at,
            is_active,
            messages,
        } = session;

        let is_active_flag = if is_active { 1 } else { 0 };
        let topic_id_ref = topic_id.as_deref();
        let last_message_at_ref = last_message_at.as_deref();
        let connection = self.db.lock().await;
        connection
            .execute(
                "INSERT INTO chat_sessions (id, name, mode, topic_id, created_at, updated_at, last_message_at, is_active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    mode=excluded.mode,
                    topic_id=excluded.topic_id,
                    created_at=excluded.created_at,
                    updated_at=excluded.updated_at,
                    last_message_at=excluded.last_message_at,
                    is_active=excluded.is_active",
                params![
                    &id,
                    &name,
                    &mode,
                    topic_id_ref,
                    &created_at,
                    &updated_at,
                    last_message_at_ref,
                    is_active_flag
                ],
            )
            .map_err(|err| err.to_string())?;

        if !messages.is_empty() {
            for message in messages {
                let metadata = message
                    .metadata
                    .as_ref()
                    .and_then(|value| serde_json::to_string(value).ok());
                let metadata_ref = metadata.as_deref();
                let message_type = message
                    .message_type
                    .clone()
                    .unwrap_or_else(|| "text".to_string());
                connection
                    .execute(
                        "INSERT INTO chat_messages (id, session_id, role, content, timestamp, message_type, metadata)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                         ON CONFLICT(id) DO UPDATE SET
                            session_id=excluded.session_id,
                            role=excluded.role,
                            content=excluded.content,
                            timestamp=excluded.timestamp,
                            message_type=excluded.message_type,
                            metadata=excluded.metadata",
                        params![
                            &message.id,
                            &id,
                            &message.role,
                            &message.content,
                            &message.timestamp,
                            &message_type,
                            metadata_ref
                        ],
                    )
                    .map_err(|err| err.to_string())?;
            }
        }

        Ok(())
    }

    pub async fn delete_session(&self, session_id: &str) -> bool {
        let connection = self.db.lock().await;
        match connection.execute(
            "DELETE FROM chat_sessions WHERE id = ?1",
            params![session_id],
        ) {
            Ok(rows) => rows > 0,
            Err(_) => false,
        }
    }

    pub async fn save_message(&self, session_id: &str, message: ChatMessage) -> Result<(), String> {
        let connection = self.db.lock().await;
        let message_type = message
            .message_type
            .clone()
            .unwrap_or_else(|| "text".to_string());
        let metadata_text = message
            .metadata
            .as_ref()
            .and_then(|value| serde_json::to_string(value).ok());
        let metadata_ref = metadata_text.as_deref();
        let message_timestamp = message.timestamp.clone();
        connection
            .execute(
                "INSERT INTO chat_messages (id, session_id, role, content, timestamp, message_type, metadata)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                    session_id=excluded.session_id,
                    role=excluded.role,
                    content=excluded.content,
                    timestamp=excluded.timestamp,
                    message_type=excluded.message_type,
                    metadata=excluded.metadata",
                params![
                    &message.id,
                    session_id,
                    &message.role,
                    &message.content,
                    &message_timestamp,
                    &message_type,
                    metadata_ref
                ],
            )
            .map_err(|err| err.to_string())?;

        connection
            .execute(
                "UPDATE chat_sessions SET
                    updated_at = ?1,
                    last_message_at = CASE
                        WHEN last_message_at IS NULL OR datetime(?2) >= datetime(last_message_at)
                        THEN ?2
                        ELSE last_message_at
                    END
                 WHERE id = ?3",
                params![current_timestamp(), &message_timestamp, session_id],
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    pub async fn load_messages(&self, session_id: &str) -> Option<Vec<ChatMessage>> {
        let connection = self.db.lock().await;
        Self::fetch_messages(&connection, session_id).ok()
    }

    pub async fn update_session_context(&self, context: SessionContext) {
        let connection = self.db.lock().await;
        connection
            .execute(
                "INSERT INTO chat_session_contexts (session_id, mode, topic_id)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(session_id) DO UPDATE SET mode=excluded.mode, topic_id=excluded.topic_id",
                params![context.session_id, context.mode, context.topic_id],
            )
            .expect("upsert context");

        connection
            .execute(
                "UPDATE chat_sessions SET mode = ?2, topic_id = ?3 WHERE id = ?1",
                params![context.session_id, context.mode, context.topic_id],
            )
            .expect("update session context");
    }

    pub async fn get_session_context(&self, session_id: &str) -> Option<SessionContext> {
        let connection = self.db.lock().await;
        connection
            .query_row(
                "SELECT session_id, mode, topic_id FROM chat_session_contexts WHERE session_id = ?1",
                params![session_id],
                |row| {
                    Ok(SessionContext {
                        session_id: row.get("session_id")?,
                        mode: row.get("mode")?,
                        topic_id: row.get("topic_id")?,
                    })
                },
            )
            .optional()
            .ok()
            .flatten()
    }

    pub async fn update_form_state(
        &self,
        session_id: &str,
        form_id: &str,
        completion_state: String,
        completion_data: Option<Value>,
    ) -> Result<Option<ChatMessage>, String> {
        let connection = self.db.lock().await;
        let messages = Self::fetch_messages(&connection, session_id)?;
        if let Some(mut message) = messages
            .iter()
            .rev()
            .find(|candidate| {
                candidate
                    .metadata
                    .as_ref()
                    .and_then(|metadata| metadata.get("formMessage"))
                    .and_then(|form| form.get("id"))
                    .and_then(|value| value.as_str())
                    == Some(form_id)
            })
            .cloned()
        {
            let mut metadata = message
                .metadata
                .clone()
                .unwrap_or_else(|| json!({ "formMessage": { "id": form_id } }));

            if let Some(form_message) = metadata
                .get_mut("formMessage")
                .and_then(|value| value.as_object_mut())
            {
                form_message.insert(
                    "completionState".to_string(),
                    Value::String(completion_state.clone()),
                );
                if let Some(data) = completion_data.clone() {
                    form_message.insert("completionResult".to_string(), data);
                }

                let serialized = serde_json::to_string(&metadata).unwrap_or_default();
                connection
                    .execute(
                        "UPDATE chat_messages SET metadata = ?1 WHERE id = ?2",
                        params![serialized, message.id],
                    )
                    .map_err(|err| err.to_string())?;

                message.metadata = Some(metadata);
                return Ok(Some(message));
            }
        }

        Ok(None)
    }

    pub async fn update_message_metadata(
        &self,
        session_id: &str,
        message_id: &str,
        patch: Value,
    ) -> Result<Option<ChatMessage>, String> {
        let connection = self.db.lock().await;
        let row = connection
            .query_row(
                "SELECT id, role, content, timestamp, message_type, metadata FROM chat_messages
                 WHERE id = ?1 AND session_id = ?2",
                params![message_id, session_id],
                |row| Self::map_message_row(row),
            )
            .optional()
            .map_err(|err| err.to_string())?;

        if let Some(mut message) = row {
            let mut current = message
                .metadata
                .clone()
                .unwrap_or_else(|| json!({}))
                .as_object()
                .cloned()
                .unwrap_or_else(Map::new);

            if let Some(patch_object) = patch.as_object() {
                for (key, value) in patch_object.iter() {
                    current.insert(key.clone(), value.clone());
                }
            }

            let updated = Value::Object(current.clone());
            let serialized = serde_json::to_string(&updated).unwrap_or_default();
            connection
                .execute(
                    "UPDATE chat_messages SET metadata = ?1 WHERE id = ?2",
                    params![serialized, message.id],
                )
                .map_err(|err| err.to_string())?;
            message.metadata = Some(updated);
            return Ok(Some(message));
        }

        Ok(None)
    }

    fn fetch_session(
        connection: &Connection,
        session_id: &str,
    ) -> Result<Option<ChatSession>, String> {
        let mut stmt = connection
            .prepare(
                "SELECT id, name, mode, topic_id, created_at, updated_at, last_message_at, is_active
                 FROM chat_sessions WHERE id = ?1",
            )
            .map_err(|err| err.to_string())?;

        let session = stmt
            .query_row(params![session_id], |row| {
                Self::map_session_row(connection, row)
            })
            .optional()
            .map_err(|err| err.to_string())?;
        Ok(session)
    }

    fn map_session_row(
        connection: &Connection,
        row: &rusqlite::Row<'_>,
    ) -> Result<ChatSession, rusqlite::Error> {
        let id: String = row.get("id")?;
        let messages = Self::fetch_messages(connection, &id).unwrap_or_default();
        let is_active: i64 = row.get("is_active")?;
        Ok(ChatSession {
            id,
            name: row.get("name")?,
            mode: row.get("mode")?,
            topic_id: row.get("topic_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            last_message_at: row.get("last_message_at")?,
            is_active: is_active != 0,
            messages,
        })
    }

    fn fetch_messages(
        connection: &Connection,
        session_id: &str,
    ) -> Result<Vec<ChatMessage>, String> {
        let mut stmt = connection
            .prepare(
                "SELECT id, role, content, timestamp, message_type, metadata
                 FROM chat_messages WHERE session_id = ?1 ORDER BY datetime(timestamp) ASC",
            )
            .map_err(|err| err.to_string())?;

        let iter = stmt
            .query_map(params![session_id], |row| Self::map_message_row(row))
            .map_err(|err| err.to_string())?;

        let mut messages = Vec::new();
        for message in iter {
            messages.push(message.map_err(|err| err.to_string())?);
        }
        Ok(messages)
    }

    fn map_message_row(row: &rusqlite::Row<'_>) -> Result<ChatMessage, rusqlite::Error> {
        let metadata_text: Option<String> = row.get("metadata")?;
        let metadata = metadata_text
            .filter(|text| !text.is_empty())
            .and_then(|text| serde_json::from_str(&text).ok());
        let message_type_text: Option<String> = row.get("message_type")?;
        let message_type = message_type_text.and_then(|value| {
            if value.trim().is_empty() {
                None
            } else {
                Some(value)
            }
        });
        Ok(ChatMessage {
            id: row.get("id")?,
            role: row.get("role")?,
            content: row.get("content")?,
            timestamp: row.get("timestamp")?,
            message_type,
            metadata,
        })
    }
}

fn current_timestamp() -> String {
    DateTime::<Utc>::from(Utc::now()).to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn create_session_persists_to_database() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "First".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        let loaded = service.load_session(&session.id).await.unwrap();
        assert_eq!(loaded.name, "First");
        assert_eq!(loaded.mode, "personal");
        assert!(loaded.is_active);
        assert!(loaded.last_message_at.is_none());
    }

    #[tokio::test]
    async fn save_and_load_session_persists_updates() {
        let service = SessionService::new_in_memory();
        let mut session = service
            .create_session(CreateSessionInput {
                name: "Initial".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        session.name = "Updated".into();
        session.mode = "hcs10".into();
        session.is_active = false;
        session.topic_id = Some("topic-1".into());
        service.save_session(session.clone()).await.unwrap();

        let loaded = service.load_session(&session.id).await.unwrap();
        assert_eq!(loaded.name, "Updated");
        assert_eq!(loaded.mode, "hcs10");
        assert_eq!(loaded.topic_id.as_deref(), Some("topic-1"));
        assert!(!loaded.is_active);
    }

    #[tokio::test]
    async fn delete_session_removes_records() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Temp".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        assert!(service.delete_session(&session.id).await);
        assert!(service.load_session(&session.id).await.is_none());
    }

    #[tokio::test]
    async fn save_message_stores_content() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Conversation".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        let message = ChatMessage {
            id: "message-1".into(),
            role: "user".into(),
            content: "Hello".into(),
            timestamp: current_timestamp(),
            message_type: Some("text".into()),
            metadata: None,
        };
        service
            .save_message(&session.id, message.clone())
            .await
            .unwrap();

        let messages = service.load_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0], message);
        let loaded_session = service.load_session(&session.id).await.unwrap();
        assert_eq!(
            loaded_session.last_message_at,
            Some(message.timestamp.clone())
        );
    }

    #[tokio::test]
    async fn save_message_updates_last_message_timestamp() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Timeline".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        let message = ChatMessage {
            id: "message-2".into(),
            role: "assistant".into(),
            content: "Reply".into(),
            timestamp: current_timestamp(),
            message_type: Some("text".into()),
            metadata: None,
        };
        service
            .save_message(&session.id, message.clone())
            .await
            .unwrap();

        let loaded = service.load_session(&session.id).await.unwrap();
        assert_eq!(loaded.last_message_at, Some(message.timestamp));
    }

    #[tokio::test]
    async fn save_message_upserts_existing_message() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Upsert".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;

        let timestamp = current_timestamp();
        let initial_message = ChatMessage {
            id: "message-upsert".into(),
            role: "assistant".into(),
            content: "Initial".into(),
            timestamp: timestamp.clone(),
            message_type: Some("text".into()),
            metadata: Some(json!({ "pendingApproval": true })),
        };

        service
            .save_message(&session.id, initial_message.clone())
            .await
            .unwrap();

        let updated_message = ChatMessage {
            id: initial_message.id.clone(),
            role: "assistant".into(),
            content: "Updated".into(),
            timestamp,
            message_type: Some("text".into()),
            metadata: Some(json!({ "approved": true })),
        };

        service
            .save_message(&session.id, updated_message.clone())
            .await
            .unwrap();

        let messages = service.load_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "Updated");
        let approved = messages[0]
            .metadata
            .as_ref()
            .and_then(|value| value.get("approved"))
            .and_then(|value| value.as_bool());
        assert_eq!(approved, Some(true));
    }

    #[tokio::test]
    async fn save_session_preserves_existing_messages_when_not_provided() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Preserve".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;

        let message = ChatMessage {
            id: "message-preserve".into(),
            role: "assistant".into(),
            content: "Persist".into(),
            timestamp: current_timestamp(),
            message_type: Some("text".into()),
            metadata: None,
        };

        service
            .save_message(&session.id, message.clone())
            .await
            .unwrap();

        let mut loaded_session = service.load_session(&session.id).await.unwrap();
        loaded_session.name = "Renamed".into();
        loaded_session.messages.clear();

        service.save_session(loaded_session).await.unwrap();

        let stored_messages = service.load_messages(&session.id).await.unwrap();
        assert_eq!(stored_messages.len(), 1);
        assert_eq!(stored_messages[0].content, "Persist");

        let updated_session = service.load_session(&session.id).await.unwrap();
        assert_eq!(updated_session.name, "Renamed");
    }

    #[tokio::test]
    async fn update_session_context_is_persisted() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Context".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        service
            .update_session_context(SessionContext {
                session_id: session.id.clone(),
                mode: "hcs10".into(),
                topic_id: Some("topic-1".into()),
            })
            .await;
        let context = service.get_session_context(&session.id).await.unwrap();
        assert_eq!(context.mode, "hcs10");
        assert_eq!(context.topic_id.as_deref(), Some("topic-1"));
    }

    #[tokio::test]
    async fn update_form_state_modifies_metadata() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Form".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        service
            .save_message(
                &session.id,
                ChatMessage {
                    id: "message-1".into(),
                    role: "assistant".into(),
                    content: "Form".into(),
                    timestamp: current_timestamp(),
                    message_type: Some("form".into()),
                    metadata: Some(json!({
                        "formMessage": {
                            "id": "form-1",
                            "completionState": "active"
                        }
                    })),
                },
            )
            .await
            .unwrap();

        let updated = service
            .update_form_state(
                &session.id,
                "form-1",
                "completed".into(),
                Some(json!({ "success": true })),
            )
            .await
            .unwrap()
            .unwrap();

        let metadata = updated.metadata.unwrap();
        let state = metadata
            .get("formMessage")
            .and_then(|value| value.get("completionState"))
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        assert_eq!(state, "completed");
    }

    #[tokio::test]
    async fn update_message_metadata_merges_fields() {
        let service = SessionService::new_in_memory();
        let session = service
            .create_session(CreateSessionInput {
                name: "Metadata".into(),
                mode: "personal".into(),
                topic_id: None,
                is_active: true,
            })
            .await;
        service
            .save_message(
                &session.id,
                ChatMessage {
                    id: "message-2".into(),
                    role: "assistant".into(),
                    content: "Meta".into(),
                    timestamp: current_timestamp(),
                    message_type: Some("text".into()),
                    metadata: Some(json!({ "pendingApproval": true })),
                },
            )
            .await
            .unwrap();

        let updated = service
            .update_message_metadata(&session.id, "message-2", json!({ "approved": true }))
            .await
            .unwrap()
            .unwrap();
        let metadata = updated.metadata.unwrap();
        assert_eq!(metadata["pendingApproval"], Value::Bool(true));
        assert_eq!(metadata["approved"], Value::Bool(true));
    }
}
