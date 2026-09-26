-- Drizzle runs migrations in a transaction, where foreign_keys=OFF is a no-op.
-- Preserve children before rebuilding recipes so ON DELETE CASCADE cannot lose data.
CREATE TEMP TABLE __saved_ingredients AS SELECT * FROM ingredients;--> statement-breakpoint
CREATE TEMP TABLE __saved_steps AS SELECT * FROM steps;--> statement-breakpoint
CREATE TEMP TABLE __saved_equipment AS SELECT * FROM recipe_equipment;--> statement-breakpoint
CREATE TEMP TABLE __saved_sessions AS SELECT * FROM cooking_sessions;--> statement-breakpoint
CREATE TABLE `__new_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`recipe_type` text DEFAULT 'food' NOT NULL,
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_recipes`("id", "title", "description", "recipe_type", "source_url", "source_type", "servings", "prep_time_minutes", "cook_time_minutes", "total_time_minutes", "difficulty", "cuisine", "image_url", "heirloom_notes", "storage_reheating", "is_favorite", "rating", "created_at", "updated_at") SELECT "id", "title", "description", "recipe_type", "source_url", "source_type", "servings", "prep_time_minutes", "cook_time_minutes", "total_time_minutes", "difficulty", "cuisine", "image_url", "heirloom_notes", "storage_reheating", "is_favorite", "rating", "created_at", "updated_at" FROM `recipes`;--> statement-breakpoint
DROP TABLE `recipes`;--> statement-breakpoint
ALTER TABLE `__new_recipes` RENAME TO `recipes`;--> statement-breakpoint
INSERT OR IGNORE INTO ingredients SELECT * FROM __saved_ingredients;--> statement-breakpoint
INSERT OR IGNORE INTO steps SELECT * FROM __saved_steps;--> statement-breakpoint
INSERT OR IGNORE INTO recipe_equipment SELECT * FROM __saved_equipment;--> statement-breakpoint
INSERT OR IGNORE INTO cooking_sessions SELECT * FROM __saved_sessions;--> statement-breakpoint
DROP TABLE __saved_ingredients;--> statement-breakpoint
DROP TABLE __saved_steps;--> statement-breakpoint
DROP TABLE __saved_equipment;--> statement-breakpoint
DROP TABLE __saved_sessions;--> statement-breakpoint
CREATE TABLE `__new_user_kitchen_profile` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`stove_type` text DEFAULT 'gas' NOT NULL,
	`oven_type` text DEFAULT 'convection_fan' NOT NULL,
	`has_microwave` integer DEFAULT true,
	`has_air_fryer` integer DEFAULT false,
	`has_instant_pot` integer DEFAULT false,
	`has_cast_iron` integer DEFAULT true,
	`has_clay_gastra` integer DEFAULT false,
	`preferred_salt_type` text DEFAULT 'table_salt'
);
--> statement-breakpoint
INSERT INTO `__new_user_kitchen_profile`("id", "stove_type", "oven_type", "has_microwave", "has_air_fryer", "has_instant_pot", "has_cast_iron", "has_clay_gastra", "preferred_salt_type") SELECT "id", "stove_type", "oven_type", "has_microwave", "has_air_fryer", "has_instant_pot", "has_cast_iron", "has_clay_gastra", "preferred_salt_type" FROM `user_kitchen_profile`;--> statement-breakpoint
DROP TABLE `user_kitchen_profile`;--> statement-breakpoint
ALTER TABLE `__new_user_kitchen_profile` RENAME TO `user_kitchen_profile`;--> statement-breakpoint
CREATE INDEX `ingredients_recipe_id_idx` ON `ingredients` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_equipment_recipe_id_idx` ON `recipe_equipment` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `steps_recipe_id_idx` ON `steps` (`recipe_id`);
