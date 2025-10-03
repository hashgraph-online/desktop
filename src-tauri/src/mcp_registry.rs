use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{Connection, params};
use serde_json::{Value, json};

pub struct McpRegistryStore {
    path: PathBuf,
}

impl McpRegistryStore {
    pub fn new(path: PathBuf) -> Result<Self, String> {
        let store = Self { path };
        store.initialize()?;
        Ok(store)
    }

    fn initialize(&self) -> Result<(), String> {
        _ensure_path(&self.path)?;
        let connection = self.open_connection()?;
        connection
            .execute_batch(
                "PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS mcp_registry_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    registry TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mcp_registry_name ON mcp_registry_servers(name);
CREATE INDEX IF NOT EXISTS idx_mcp_registry_registry ON mcp_registry_servers(registry);
CREATE TABLE IF NOT EXISTS mcp_registry_sync (
    registry TEXT PRIMARY KEY,
    last_sync_at INTEGER,
    last_success_at INTEGER,
    server_count INTEGER DEFAULT 0,
    status TEXT,
    error_message TEXT,
    sync_duration_ms INTEGER
);
",
            )
            .map_err(|error| format!("Failed to initialize registry store: {error}"))?;
        Ok(())
    }

    fn open_connection(&self) -> Result<Connection, String> {
        Connection::open(&self.path)
            .map_err(|error| format!("Failed to open registry store: {error}"))
    }

    pub fn upsert_servers(&self, registry: &str, servers: &[Value]) -> Result<(), String> {
        let mut connection = self.open_connection()?;
        let transaction = connection
            .transaction()
            .map_err(|error| format!("Failed to start registry transaction: {error}"))?;

        for server in servers {
            let Some(id) = server.get("id").and_then(Value::as_str) else {
                continue;
            };

            let name = server.get("name").and_then(Value::as_str).unwrap_or(id);
            let description = server
                .get("description")
                .and_then(Value::as_str)
                .unwrap_or("");
            let tags = server.get("tags").and_then(Value::as_array).map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(",")
            });
            let payload = serde_json::to_string(server)
                .map_err(|error| format!("Failed to serialize registry server {id}: {error}"))?;
            let updated_at = Utc::now().timestamp();

            transaction
                .execute(
                    "INSERT INTO mcp_registry_servers (id, name, description, tags, registry, updated_at, payload)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(id) DO UPDATE SET
                       name=excluded.name,
                       description=excluded.description,
                       tags=excluded.tags,
                       registry=excluded.registry,
                       updated_at=excluded.updated_at,
                       payload=excluded.payload",
                    params![id, name, description, tags, registry, updated_at, payload],
                )
                .map_err(|error| format!("Failed to upsert registry server {id}: {error}"))?;
        }

        transaction
            .commit()
            .map_err(|error| format!("Failed to commit registry transaction: {error}"))
    }

    pub fn all_servers(&self) -> Result<Vec<Value>, String> {
        let connection = self.open_connection()?;
        let mut statement = connection
            .prepare("SELECT payload FROM mcp_registry_servers")
            .map_err(|error| format!("Failed to prepare registry query: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Failed to query registry servers: {error}"))?;

        let mut servers = Vec::new();
        for row in rows {
            match row {
                Ok(payload) => match serde_json::from_str::<Value>(&payload) {
                    Ok(value) => servers.push(value),
                    Err(error) => {
                        log::debug!("Failed to parse cached registry server: {}", error);
                    }
                },
                Err(error) => {
                    log::debug!("Failed to read cached registry server: {}", error);
                }
            }
        }
        Ok(servers)
    }

    pub fn record_sync_success(
        &self,
        registry: &str,
        server_count: usize,
        duration_ms: Option<u64>,
    ) -> Result<(), String> {
        let connection = self.open_connection()?;
        connection
            .execute(
                "INSERT INTO mcp_registry_sync (registry, last_sync_at, last_success_at, server_count, status, error_message, sync_duration_ms)
                 VALUES (?1, ?2, ?2, ?3, 'success', NULL, ?4)
                 ON CONFLICT(registry) DO UPDATE SET
                   last_sync_at=excluded.last_sync_at,
                   last_success_at=excluded.last_success_at,
                   server_count=excluded.server_count,
                   status='success',
                   error_message=NULL,
                   sync_duration_ms=excluded.sync_duration_ms",
                params![registry, Utc::now().timestamp(), server_count as i64, duration_ms.map(|value| value as i64)],
            )
            .map_err(|error| format!("Failed to record registry sync: {error}"))?;
        Ok(())
    }

    pub fn record_sync_failure(&self, registry: &str, message: &str) -> Result<(), String> {
        let connection = self.open_connection()?;
        connection
            .execute(
                "INSERT INTO mcp_registry_sync (registry, last_sync_at, status, error_message)
                 VALUES (?1, ?2, 'error', ?3)
                 ON CONFLICT(registry) DO UPDATE SET
                   last_sync_at=excluded.last_sync_at,
                   status='error',
                   error_message=excluded.error_message",
                params![registry, Utc::now().timestamp(), message],
            )
            .map_err(|error| format!("Failed to record registry error: {error}"))?;
        Ok(())
    }

    pub fn sync_snapshot(&self) -> Value {
        let connection = match self.open_connection() {
            Ok(conn) => conn,
            Err(_) => return Value::Null,
        };
        let mut statement = match connection
            .prepare("SELECT registry, last_sync_at, last_success_at, server_count, status, error_message FROM mcp_registry_sync")
        {
            Ok(stmt) => stmt,
            Err(_) => return Value::Null,
        };

        let rows = statement.query_map([], |row| {
            let registry: String = row.get(0)?;
            let last_sync: Option<i64> = row.get(1)?;
            let last_success: Option<i64> = row.get(2)?;
            let count: i64 = row.get(3)?;
            let status: Option<String> = row.get(4)?;
            let error: Option<String> = row.get(5)?;
            Ok((registry, last_sync, last_success, count, status, error))
        });

        let mut entries = serde_json::Map::new();
        if let Ok(rows) = rows {
            for row in rows.flatten() {
                let (registry, last_sync, last_success, count, status, error) = row;
                entries.insert(
                    registry,
                    json!({
                        "lastSyncAt": last_sync,
                        "lastSuccessAt": last_success,
                        "serverCount": count,
                        "status": status,
                        "error": error
                    }),
                );
            }
        }

        Value::Object(entries)
    }
}

fn _ensure_path(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create registry directory: {error}"))?;
    }
    Ok(())
}
