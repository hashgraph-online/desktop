
CREATE TABLE `mcp_metric_status` (
	`server_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`status` text DEFAULT 'pending',
	`last_success_at` integer,
	`last_attempt_at` integer,
	`next_update_at` integer,
	`value` integer,
	`retry_count` integer DEFAULT 0,
	`error_code` text,
	`error_message` text,
	FOREIGN KEY (`server_id`) REFERENCES `mcp_servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mcp_metric_status_unique` ON `mcp_metric_status` (`server_id`,`metric_type`);--> statement-breakpoint
CREATE INDEX `idx_mcp_metric_status_next_update` ON `mcp_metric_status` (`next_update_at`);
