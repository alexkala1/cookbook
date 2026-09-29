CREATE TABLE `cook_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`cooked_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`servings` integer DEFAULT 4 NOT NULL,
	`notes` text,
	`rating` real,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cook_logs_recipe_id_idx` ON `cook_logs` (`recipe_id`);