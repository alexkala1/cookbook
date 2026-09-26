CREATE TABLE `cooking_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`user_rating` integer,
	`session_notes` text,
	`photo_url` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grocery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real,
	`unit` text,
	`category` text DEFAULT 'pantry' NOT NULL,
	`store_destination` text DEFAULT 'supermarket' NOT NULL,
	`counter_phrase` text,
	`package_size_to_buy` text,
	`surplus_leftover_tip` text,
	`course_breakdown` text,
	`is_checked` integer DEFAULT false NOT NULL,
	`recipe_origin_id` text,
	FOREIGN KEY (`list_id`) REFERENCES `grocery_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grocery_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allergies` text,
	`dietary_restrictions` text,
	`dislikes` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`grams_equivalent` real,
	`category` text DEFAULT 'pantry' NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`category` text DEFAULT 'pantry' NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `recipe_equipment` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`name` text NOT NULL,
	`is_essential` integer DEFAULT true NOT NULL,
	`substitute_tool` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
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
	`rating` real DEFAULT 5,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`instruction` text NOT NULL,
	`duration_minutes` integer,
	`timer_required` integer DEFAULT false NOT NULL,
	`heat_level` text,
	`science_why` text,
	`failure_prevention` text,
	`sensory_visual` text,
	`sensory_audio` text,
	`sensory_aroma` text,
	`sensory_texture` text,
	`internal_temp_target_c` real,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_kitchen_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`stove_type` text DEFAULT 'gas' NOT NULL,
	`oven_type` text DEFAULT 'convection_fan' NOT NULL,
	`has_microwave` integer DEFAULT true,
	`has_air_fryer` integer DEFAULT false,
	`has_instant_pot` integer DEFAULT false,
	`has_cast_iron` integer DEFAULT true,
	`has_clay_gastra` integer DEFAULT false,
	`preferred_salt_type` text DEFAULT 'table_salt'
);
