CREATE TABLE `recipe_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`cook_date` integer NOT NULL,
	`rating` integer,
	`notes` text,
	`family_memories` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_memories_rating" CHECK("recipe_memories"."rating" IS NULL OR ("recipe_memories"."rating" BETWEEN 1 AND 5 AND "recipe_memories"."rating" = CAST("recipe_memories"."rating" AS INTEGER)))
);
--> statement-breakpoint
CREATE INDEX `recipe_memories_recipe_id_idx` ON `recipe_memories` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `__new_guests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allergies` text,
	`dietary_restrictions` text,
	`dislikes` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Preserve guest profiles; legacy unknown creation times use migration time.
INSERT INTO `__new_guests`("id", "name", "allergies", "dietary_restrictions", "dislikes", "notes", "created_at", "updated_at")
SELECT id, name, allergies, dietary_restrictions, dislikes, notes,
COALESCE(CAST(round(unixepoch(created_at, 'subsec') * 1000) AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
COALESCE(CAST(round(unixepoch(created_at, 'subsec') * 1000) AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER))
FROM guests;--> statement-breakpoint
DROP TABLE `guests`;--> statement-breakpoint
ALTER TABLE `__new_guests` RENAME TO `guests`;
