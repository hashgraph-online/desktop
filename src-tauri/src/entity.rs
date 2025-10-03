use chrono::Utc;
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use tokio::sync::Mutex;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EntityAssociation {
    pub entity_id: String,
    pub entity_name: String,
    pub entity_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EntityStoreResult {
    pub entity: EntityAssociation,
    pub created: bool,
}

pub struct EntityService {
    db: Mutex<Connection>,
}

impl EntityService {
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
                CREATE TABLE IF NOT EXISTS entity_associations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_id TEXT NOT NULL,
                    entity_name TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    transaction_id TEXT,
                    session_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    metadata TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_entity_associations_entity_id
                    ON entity_associations(entity_id);
                CREATE INDEX IF NOT EXISTS idx_entity_associations_entity_type
                    ON entity_associations(entity_type);
                CREATE INDEX IF NOT EXISTS idx_entity_associations_session_id
                    ON entity_associations(session_id);
                CREATE INDEX IF NOT EXISTS idx_entity_associations_created_at
                    ON entity_associations(created_at);
                CREATE INDEX IF NOT EXISTS idx_entity_associations_active
                    ON entity_associations(is_active);
                "#,
            )
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    fn map_row(row: &Row<'_>) -> Result<EntityAssociation, rusqlite::Error> {
        let metadata: Option<String> = row.get("metadata")?;
        let metadata_value = metadata.and_then(|raw| serde_json::from_str(&raw).ok());

        Ok(EntityAssociation {
            entity_id: row.get("entity_id")?,
            entity_name: row.get("entity_name")?,
            entity_type: row.get("entity_type")?,
            transaction_id: row.get("transaction_id")?,
            session_id: row.get("session_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            is_active: row.get::<_, i64>("is_active")? == 1,
            metadata: metadata_value,
        })
    }

    pub async fn store_entity(
        &self,
        entity_id: &str,
        entity_name: &str,
        entity_type: &str,
        transaction_id: Option<&str>,
        session_id: Option<&str>,
        metadata: Option<&Value>,
    ) -> Result<EntityStoreResult, String> {
        let connection = self.db.lock().await;

        let mut statement = connection
            .prepare(
                "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n                 FROM entity_associations\n                 WHERE entity_id = ?1 AND is_active = 1\n                 ORDER BY datetime(created_at) DESC\n                 LIMIT 1",
            )
            .map_err(|err| err.to_string())?;

        let existing = statement
            .query_row(params![entity_id], Self::map_row)
            .optional()
            .map_err(|err| err.to_string())?;

        if let Some(entity) = existing {
            return Ok(EntityStoreResult {
                entity,
                created: false,
            });
        }

        let trimmed_name = entity_name.trim();
        let final_name = if trimmed_name.is_empty() {
            entity_id
        } else {
            trimmed_name
        };

        let serialized_metadata = if let Some(value) = metadata {
            Some(serde_json::to_string(value).map_err(|err| err.to_string())?)
        } else {
            None
        };

        let now = Utc::now().to_rfc3339();
        connection
            .execute(
                "INSERT INTO entity_associations (entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)",
                params![
                    entity_id,
                    final_name,
                    entity_type,
                    transaction_id,
                    session_id,
                    now,
                    now,
                    serialized_metadata
                ],
            )
            .map_err(|err| err.to_string())?;

        let mut statement = connection
            .prepare(
                "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n                 FROM entity_associations\n                 WHERE entity_id = ?1 AND is_active = 1\n                 ORDER BY datetime(created_at) DESC\n                 LIMIT 1",
            )
            .map_err(|err| err.to_string())?;

        let inserted = statement
            .query_row(params![entity_id], Self::map_row)
            .map_err(|err| err.to_string())?;

        Ok(EntityStoreResult {
            entity: inserted,
            created: true,
        })
    }

    pub async fn list_entities(
        &self,
        entity_type: Option<String>,
        session_id: Option<String>,
        limit: Option<usize>,
    ) -> Result<Vec<EntityAssociation>, String> {
        let limit_value = limit.unwrap_or(1000) as i64;
        let connection = self.db.lock().await;
        let mut entities = Vec::new();

        match (entity_type.as_ref(), session_id.as_ref()) {
            (Some(entity_type), Some(session_id)) => {
                let mut statement = connection
                    .prepare(
                        "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1 AND entity_type = ?1 AND session_id = ?2\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?3",
                    )
                    .map_err(|err| err.to_string())?;
                let rows = statement
                    .query_map(params![entity_type, session_id, limit_value], Self::map_row)
                    .map_err(|err| err.to_string())?;
                for row in rows {
                    entities.push(row.map_err(|err| err.to_string())?);
                }
            }
            (Some(entity_type), None) => {
                let mut statement = connection
                    .prepare(
                        "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1 AND entity_type = ?1\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?2",
                    )
                    .map_err(|err| err.to_string())?;
                let rows = statement
                    .query_map(params![entity_type, limit_value], Self::map_row)
                    .map_err(|err| err.to_string())?;
                for row in rows {
                    entities.push(row.map_err(|err| err.to_string())?);
                }
            }
            (None, Some(session_id)) => {
                let mut statement = connection
                    .prepare(
                        "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1 AND session_id = ?1\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?2",
                    )
                    .map_err(|err| err.to_string())?;
                let rows = statement
                    .query_map(params![session_id, limit_value], Self::map_row)
                    .map_err(|err| err.to_string())?;
                for row in rows {
                    entities.push(row.map_err(|err| err.to_string())?);
                }
            }
            (None, None) => {
                let mut statement = connection
                    .prepare(
                        "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?1",
                    )
                    .map_err(|err| err.to_string())?;
                let rows = statement
                    .query_map(params![limit_value], Self::map_row)
                    .map_err(|err| err.to_string())?;
                for row in rows {
                    entities.push(row.map_err(|err| err.to_string())?);
                }
            }
        }

        Ok(entities)
    }

    pub async fn get_entity(&self, entity_id: &str) -> Result<Option<EntityAssociation>, String> {
        let connection = self.db.lock().await;
        let mut statement = connection
            .prepare(
                "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n                 FROM entity_associations\n                 WHERE entity_id = ?1 AND is_active = 1\n                 ORDER BY datetime(created_at) DESC\n                 LIMIT 1",
            )
            .map_err(|err| err.to_string())?;

        let result = statement
            .query_row(params![entity_id], Self::map_row)
            .optional()
            .map_err(|err| err.to_string())?;

        Ok(result)
    }

    pub async fn deactivate_entity(&self, entity_id: &str) -> Result<bool, String> {
        let connection = self.db.lock().await;
        let now = Utc::now().to_rfc3339();
        let changes = connection
            .execute(
                "UPDATE entity_associations SET is_active = 0, updated_at = ?2 WHERE entity_id = ?1",
                params![entity_id, now],
            )
            .map_err(|err| err.to_string())?;

        Ok(changes > 0)
    }

    pub async fn rename_entity(
        &self,
        entity_id: &str,
        new_name: &str,
    ) -> Result<Option<EntityAssociation>, String> {
        let connection = self.db.lock().await;
        let now = Utc::now().to_rfc3339();
        let changes = connection
            .execute(
                "UPDATE entity_associations SET entity_name = ?2, updated_at = ?3 WHERE entity_id = ?1 AND is_active = 1",
                params![entity_id, new_name, now],
            )
            .map_err(|err| err.to_string())?;

        if changes == 0 {
            return Ok(None);
        }

        let mut statement = connection
            .prepare(
                "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n                 FROM entity_associations\n                 WHERE entity_id = ?1 AND is_active = 1\n                 ORDER BY datetime(updated_at) DESC\n                 LIMIT 1",
            )
            .map_err(|err| err.to_string())?;

        let entity = statement
            .query_row(params![entity_id], Self::map_row)
            .optional()
            .map_err(|err| err.to_string())?;

        Ok(entity)
    }

    pub async fn search_entities(
        &self,
        query: &str,
        entity_type: Option<&str>,
        limit: usize,
    ) -> Result<Vec<EntityAssociation>, String> {
        let search_term = format!("%{}%", query.to_lowercase());
        let connection = self.db.lock().await;
        let mut entities = Vec::new();

        if let Some(entity_type) = entity_type {
            let mut statement = connection
                .prepare(
                    "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1\n             AND (LOWER(entity_name) LIKE ?1 OR LOWER(entity_id) LIKE ?1 OR LOWER(COALESCE(transaction_id, '')) LIKE ?1)\n             AND entity_type = ?2\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?3",
                )
                .map_err(|err| err.to_string())?;
            let rows = statement
                .query_map(
                    params![search_term, entity_type, limit as i64],
                    Self::map_row,
                )
                .map_err(|err| err.to_string())?;
            for row in rows {
                entities.push(row.map_err(|err| err.to_string())?);
            }
        } else {
            let mut statement = connection
                .prepare(
                    "SELECT entity_id, entity_name, entity_type, transaction_id, session_id, created_at, updated_at, is_active, metadata\n             FROM entity_associations\n             WHERE is_active = 1\n             AND (LOWER(entity_name) LIKE ?1 OR LOWER(entity_id) LIKE ?1 OR LOWER(COALESCE(transaction_id, '')) LIKE ?1)\n             ORDER BY datetime(created_at) DESC\n             LIMIT ?2",
                )
                .map_err(|err| err.to_string())?;
            let rows = statement
                .query_map(params![search_term, limit as i64], Self::map_row)
                .map_err(|err| err.to_string())?;
            for row in rows {
                entities.push(row.map_err(|err| err.to_string())?);
            }
        }

        Ok(entities)
    }
}

#[cfg(test)]
mod tests {
    use super::EntityService;
    use serde_json::json;

    #[tokio::test]
    async fn rename_updates_existing_entity() {
        let service = EntityService::new_in_memory();
        {
            let connection = service.db.lock().await;
            connection
                .execute(
                    "INSERT INTO entity_associations (entity_id, entity_name, entity_type, created_at, updated_at, is_active) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'), 1)",
                    rusqlite::params!["entity-1", "Original", "account"],
                )
                .expect("insert entity");
        }

        let renamed = service
            .rename_entity("entity-1", "Updated")
            .await
            .expect("rename entity");

        assert!(renamed.is_some());
        assert_eq!(renamed.unwrap().entity_name, "Updated");
    }

    #[tokio::test]
    async fn deactivate_marks_entity_inactive() {
        let service = EntityService::new_in_memory();
        {
            let connection = service.db.lock().await;
            connection
                .execute(
                    "INSERT INTO entity_associations (entity_id, entity_name, entity_type, created_at, updated_at, is_active) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'), 1)",
                    rusqlite::params!["entity-2", "Entity", "contract"],
                )
                .expect("insert entity");
        }

        let deactivated = service
            .deactivate_entity("entity-2")
            .await
            .expect("deactivate entity");

        assert!(deactivated);

        let remaining = service.get_entity("entity-2").await.expect("fetch entity");

        assert!(remaining.is_none());
    }

    #[tokio::test]
    async fn store_entity_inserts_new_entity() {
        let service = EntityService::new_in_memory();

        let result = service
            .store_entity(
                "0.0.1001",
                "DemoToken",
                "tokenId",
                Some("0.0.2001@123456"),
                Some("session-1"),
                None,
            )
            .await
            .expect("store entity");

        assert!(result.created);
        assert_eq!(result.entity.entity_id, "0.0.1001");
        assert_eq!(result.entity.entity_name, "DemoToken");
        assert_eq!(result.entity.entity_type, "tokenId");
        assert_eq!(
            result.entity.transaction_id.as_deref(),
            Some("0.0.2001@123456")
        );
        assert_eq!(result.entity.session_id.as_deref(), Some("session-1"));
        assert!(result.entity.metadata.is_none());

        let all = service
            .list_entities(None, None, None)
            .await
            .expect("list entities");
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn store_entity_returns_existing_without_duplicate() {
        let service = EntityService::new_in_memory();

        let first = service
            .store_entity(
                "0.0.1002",
                "Initial",
                "tokenId",
                Some("0.0.3001@111"),
                None,
                None,
            )
            .await
            .expect("store initial entity");
        assert!(first.created);

        let second = service
            .store_entity(
                "0.0.1002",
                "Renamed",
                "tokenId",
                Some("0.0.3001@111"),
                Some("session-2"),
                None,
            )
            .await
            .expect("store duplicate entity");

        assert!(!second.created);
        assert_eq!(second.entity.entity_name, "Initial");
        let all = service
            .list_entities(None, None, None)
            .await
            .expect("list entities");
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn store_entity_persists_metadata() {
        let service = EntityService::new_in_memory();
        let metadata = json!({
            "network": "testnet",
            "source": "transactionApproval",
        });

        let stored = service
            .store_entity(
                "0.0.1003",
                "WithMetadata",
                "contractId",
                None,
                None,
                Some(&metadata),
            )
            .await
            .expect("store entity with metadata");

        assert!(stored.created);
        assert_eq!(stored.entity.metadata, Some(metadata));
    }
}
