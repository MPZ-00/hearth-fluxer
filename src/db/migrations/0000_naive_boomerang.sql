CREATE TABLE `hearth_guilds` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presence_cache` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`opted_in` integer DEFAULT false NOT NULL,
	`notify` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whitelist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`member_id` text NOT NULL,
	`source` text DEFAULT 'command' NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whitelist_owner_member_unique` ON `whitelist` (`owner_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `idx_whitelist_owner` ON `whitelist` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_whitelist_member` ON `whitelist` (`member_id`);