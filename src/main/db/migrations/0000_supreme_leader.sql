CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()),
	`metadata` text,
	`message_type` text DEFAULT 'text',
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session_id` ON `chat_messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_timestamp` ON `chat_messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_role` ON `chat_messages` (`role`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_message_type` ON `chat_messages` (`message_type`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session_timestamp` ON `chat_messages` (`session_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`topic_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`last_message_at` integer,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_mode` ON `chat_sessions` (`mode`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_topic_id` ON `chat_sessions` (`topic_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_created_at` ON `chat_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_last_message_at` ON `chat_sessions` (`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_active` ON `chat_sessions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_mode_topic` ON `chat_sessions` (`mode`,`topic_id`);--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author` text,
	`version` text,
	`url` text,
	`package_name` text,
	`repository_type` text,
	`repository_url` text,
	`config_command` text,
	`config_args` text,
	`config_env` text,
	`tags` text,
	`license` text,
	`created_at` text,
	`updated_at` text,
	`install_count` integer DEFAULT 0,
	`rating` real,
	`registry` text NOT NULL,
	`is_active` integer DEFAULT true,
	`last_fetched` integer DEFAULT (unixepoch()),
	`search_vector` text
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_name` ON `mcp_servers` (`name`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_author` ON `mcp_servers` (`author`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_registry` ON `mcp_servers` (`registry`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_install_count` ON `mcp_servers` (`install_count`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_rating` ON `mcp_servers` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_last_fetched` ON `mcp_servers` (`last_fetched`);--> statement-breakpoint
CREATE INDEX `idx_mcp_servers_active` ON `mcp_servers` (`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mcp_servers_package_name` ON `mcp_servers` (`package_name`);--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`cache_hit` integer DEFAULT false,
	`result_count` integer,
	`error_count` integer DEFAULT 0,
	`memory_usage_mb` real,
	`timestamp` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_performance_metrics_operation` ON `performance_metrics` (`operation`);--> statement-breakpoint
CREATE INDEX `idx_performance_metrics_timestamp` ON `performance_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_performance_metrics_duration` ON `performance_metrics` (`duration_ms`);--> statement-breakpoint
CREATE INDEX `idx_performance_metrics_cache_hit` ON `performance_metrics` (`cache_hit`);--> statement-breakpoint
CREATE TABLE `registry_sync` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registry` text NOT NULL,
	`last_sync_at` integer,
	`last_success_at` integer,
	`server_count` integer DEFAULT 0,
	`status` text DEFAULT 'pending',
	`error_message` text,
	`sync_duration_ms` integer,
	`next_sync_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registry_sync_registry_unique` ON `registry_sync` (`registry`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_registry_sync_registry` ON `registry_sync` (`registry`);--> statement-breakpoint
CREATE INDEX `idx_registry_sync_last_sync` ON `registry_sync` (`last_sync_at`);--> statement-breakpoint
CREATE INDEX `idx_registry_sync_status` ON `registry_sync` (`status`);--> statement-breakpoint
CREATE INDEX `idx_registry_sync_next_sync` ON `registry_sync` (`next_sync_at`);--> statement-breakpoint
CREATE TABLE `search_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`query_hash` text NOT NULL,
	`query_text` text,
	`tags` text,
	`category` text,
	`search_offset` integer DEFAULT 0,
	`page_limit` integer DEFAULT 50,
	`result_ids` text NOT NULL,
	`total_count` integer NOT NULL,
	`has_more` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	`expires_at` integer NOT NULL,
	`hit_count` integer DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_cache_query_hash_unique` ON `search_cache` (`query_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_search_cache_query_hash` ON `search_cache` (`query_hash`);--> statement-breakpoint
CREATE INDEX `idx_search_cache_expires_at` ON `search_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_search_cache_created_at` ON `search_cache` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_search_cache_hit_count` ON `search_cache` (`hit_count`);--> statement-breakpoint
CREATE TABLE `server_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` text NOT NULL,
	`category` text NOT NULL,
	`confidence` real DEFAULT 1,
	`source` text DEFAULT 'manual',
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_server_categories_server_category` ON `server_categories` (`server_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_server_categories_category` ON `server_categories` (`category`);--> statement-breakpoint
CREATE INDEX `idx_server_categories_confidence` ON `server_categories` (`confidence`);
