PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'item' NOT NULL,
	`storage_location` text DEFAULT 'pantry' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "pantry_storage_location" CHECK("__new_pantry_items"."storage_location" in ('pantry', 'fridge', 'freezer', 'spices'))
);
--> statement-breakpoint
INSERT INTO `__new_pantry_items`("id", "name", "normalized_name", "quantity", "unit", "storage_location", "expires_at", "created_at", "updated_at") SELECT "id", "name", "normalized_name", "quantity", "unit", "storage_location", "expires_at", "created_at", "updated_at" FROM `pantry_items`;--> statement-breakpoint
DROP TABLE `pantry_items`;--> statement-breakpoint
ALTER TABLE `__new_pantry_items` RENAME TO `pantry_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `pantry_name_location_idx` ON `pantry_items` (`normalized_name`,`storage_location`);