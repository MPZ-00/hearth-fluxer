CREATE TABLE `kick_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`reason` text NOT NULL DEFAULT 'hearth /status off',
	`queued_at` integer NOT NULL DEFAULT (unixepoch()),
	`attempts` integer NOT NULL DEFAULT 0
);