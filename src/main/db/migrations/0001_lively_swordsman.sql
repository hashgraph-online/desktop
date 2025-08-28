CREATE TABLE `entity_associations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_id` text NOT NULL,
	`entity_name` text NOT NULL,
	`entity_type` text NOT NULL,
	`transaction_id` text,
	`session_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`is_active` integer DEFAULT true,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `idx_entity_associations_entity_id` ON `entity_associations` (`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_associations_entity_type` ON `entity_associations` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_entity_associations_session_id` ON `entity_associations` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_associations_entity_name` ON `entity_associations` (`entity_name`);--> statement-breakpoint
CREATE INDEX `idx_entity_associations_created_at` ON `entity_associations` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_entity_associations_active` ON `entity_associations` (`is_active`);
