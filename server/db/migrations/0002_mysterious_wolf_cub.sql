-- Preserve children while rebuilding parents inside Drizzle's transaction.
-- PRAGMA foreign_keys=OFF cannot change enforcement within that transaction.
CREATE TEMP TABLE __hardening_ingredients AS SELECT * FROM ingredients;--> statement-breakpoint
CREATE TEMP TABLE __hardening_steps AS SELECT * FROM steps;--> statement-breakpoint
CREATE TEMP TABLE __hardening_equipment AS SELECT * FROM recipe_equipment;--> statement-breakpoint
CREATE TEMP TABLE __hardening_sessions AS SELECT * FROM cooking_sessions;--> statement-breakpoint
CREATE TEMP TABLE __hardening_grocery_items AS SELECT * FROM grocery_items;--> statement-breakpoint
CREATE TABLE `__new_cooking_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`started_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`completed_at` text,
	`user_rating` integer,
	`session_notes` text,
	`photo_url` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cooking_sessions`("id", "recipe_id", "started_at", "completed_at", "user_rating", "session_notes", "photo_url") SELECT "id", "recipe_id", "started_at", "completed_at", "user_rating", "session_notes", "photo_url" FROM `cooking_sessions`;--> statement-breakpoint
DROP TABLE `cooking_sessions`;--> statement-breakpoint
ALTER TABLE `__new_cooking_sessions` RENAME TO `cooking_sessions`;--> statement-breakpoint
CREATE TABLE `__new_grocery_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_grocery_lists`("id", "title", "created_at") SELECT "id", "title", "created_at" FROM `grocery_lists`;--> statement-breakpoint
DROP TABLE `grocery_lists`;--> statement-breakpoint
ALTER TABLE `__new_grocery_lists` RENAME TO `grocery_lists`;--> statement-breakpoint
CREATE TABLE `__new_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allergies` text,
	`dietary_restrictions` text,
	`dislikes` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_guests`("id", "name", "allergies", "dietary_restrictions", "dislikes", "notes", "created_at") SELECT "id", "name", "allergies", "dietary_restrictions", "dislikes", "notes", "created_at" FROM `guests`;--> statement-breakpoint
DROP TABLE `guests`;--> statement-breakpoint
ALTER TABLE `__new_guests` RENAME TO `guests`;--> statement-breakpoint
CREATE TABLE `__new_pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`category` text DEFAULT 'pantry' NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_pantry_items`("id", "name", "quantity", "unit", "category", "expires_at", "created_at") SELECT "id", "name", "quantity", "unit", "category", "expires_at", "created_at" FROM `pantry_items`;--> statement-breakpoint
DROP TABLE `pantry_items`;--> statement-breakpoint
ALTER TABLE `__new_pantry_items` RENAME TO `pantry_items`;--> statement-breakpoint
CREATE TABLE `__new_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`recipe_type` text DEFAULT 'food' NOT NULL,
	`original_salt_type` text,
	`source_url` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`servings` integer DEFAULT 4 NOT NULL,
	`prep_time_minutes` integer DEFAULT 15 NOT NULL,
	`cook_time_minutes` integer DEFAULT 30 NOT NULL,
	`total_time_minutes` integer DEFAULT 45 NOT NULL,
	`difficulty` text DEFAULT 'intermediate' NOT NULL,
	`cuisine` text,
	`image_url` text,
	`heirloom_notes` text,
	`storage_reheating` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`rating` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_recipes`("id", "title", "description", "recipe_type", "original_salt_type", "source_url", "source_type", "servings", "prep_time_minutes", "cook_time_minutes", "total_time_minutes", "difficulty", "cuisine", "image_url", "heirloom_notes", "storage_reheating", "is_favorite", "rating", "created_at", "updated_at") SELECT "id", "title", "description", "recipe_type", NULL, "source_url", "source_type", "servings", "prep_time_minutes", "cook_time_minutes", "total_time_minutes", "difficulty", "cuisine", "image_url", "heirloom_notes", "storage_reheating", "is_favorite", "rating", "created_at", "updated_at" FROM `recipes`;--> statement-breakpoint
DROP TABLE `recipes`;--> statement-breakpoint
ALTER TABLE `__new_recipes` RENAME TO `recipes`;
--> statement-breakpoint
INSERT OR IGNORE INTO ingredients SELECT * FROM __hardening_ingredients;--> statement-breakpoint
INSERT OR IGNORE INTO steps SELECT * FROM __hardening_steps;--> statement-breakpoint
INSERT OR IGNORE INTO recipe_equipment SELECT * FROM __hardening_equipment;--> statement-breakpoint
INSERT OR IGNORE INTO cooking_sessions SELECT * FROM __hardening_sessions;--> statement-breakpoint
INSERT OR IGNORE INTO grocery_items SELECT * FROM __hardening_grocery_items;--> statement-breakpoint
DROP TABLE __hardening_ingredients;--> statement-breakpoint
DROP TABLE __hardening_steps;--> statement-breakpoint
DROP TABLE __hardening_equipment;--> statement-breakpoint
DROP TABLE __hardening_sessions;--> statement-breakpoint
DROP TABLE __hardening_grocery_items;--> statement-breakpoint
UPDATE user_kitchen_profile SET preferred_salt_type = 'greek_fine_sea_salt' WHERE preferred_salt_type = 'greek_sea_salt';--> statement-breakpoint
-- Convert valid historical timestamps without discarding null or unparseable values.
UPDATE recipes SET created_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', created_at), created_at), updated_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', updated_at), updated_at);--> statement-breakpoint
UPDATE pantry_items SET created_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', created_at), created_at);--> statement-breakpoint
UPDATE grocery_lists SET created_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', created_at), created_at);--> statement-breakpoint
UPDATE guests SET created_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', created_at), created_at);--> statement-breakpoint
UPDATE cooking_sessions SET started_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', started_at), started_at), completed_at = coalesce(strftime('%Y-%m-%dT%H:%M:%fZ', completed_at), completed_at);
