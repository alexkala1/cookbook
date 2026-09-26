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
	CONSTRAINT "pantry_storage_location" CHECK("__new_pantry_items"."storage_location" in ('pantry', 'fridge', 'freezer'))
);
--> statement-breakpoint
-- Preserve legacy inventory and convert ISO UTC timestamps to epoch milliseconds.
INSERT INTO `__new_pantry_items`("id", "name", "normalized_name", "quantity", "unit", "storage_location", "expires_at", "created_at", "updated_at")
SELECT id, name, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(trim(name)), 'Α', 'α'), 'Β', 'β'), 'Γ', 'γ'), 'Δ', 'δ'), 'Ε', 'ε'), 'Ζ', 'ζ'), 'Η', 'η'), 'Θ', 'θ'), 'Ι', 'ι'), 'Κ', 'κ'), 'Λ', 'λ'), 'Μ', 'μ'), 'Ν', 'ν'), 'Ξ', 'ξ'), 'Ο', 'ο'), 'Π', 'π'), 'Ρ', 'ρ'), 'Σ', 'σ'), 'Τ', 'τ'), 'Υ', 'υ'), 'Φ', 'φ'), 'Χ', 'χ'), 'Ψ', 'ψ'), 'Ω', 'ω'), 'Ά', 'α'), 'Έ', 'ε'), 'Ή', 'η'), 'Ί', 'ι'), 'Ό', 'ο'), 'Ύ', 'υ'), 'Ώ', 'ω'), 'Ϊ', 'ι'), 'Ϋ', 'υ'), 'ά', 'α'), 'έ', 'ε'), 'ή', 'η'), 'ί', 'ι'), 'ό', 'ο'), 'ύ', 'υ'), 'ώ', 'ω'), 'ϊ', 'ι'), 'ϋ', 'υ'), 'ΐ', 'ι'), 'ΰ', 'υ'), 'ς', 'σ'), quantity, unit,
CASE WHEN category IN ('pantry', 'fridge', 'freezer') THEN category ELSE 'pantry' END,
CAST(round(unixepoch(expires_at, 'subsec') * 1000) AS INTEGER),
COALESCE(CAST(round(unixepoch(created_at, 'subsec') * 1000) AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER)),
COALESCE(CAST(round(unixepoch(created_at, 'subsec') * 1000) AS INTEGER), CAST(unixepoch('subsec') * 1000 AS INTEGER))
FROM pantry_items;--> statement-breakpoint
DROP TABLE `pantry_items`;--> statement-breakpoint
ALTER TABLE `__new_pantry_items` RENAME TO `pantry_items`;--> statement-breakpoint
CREATE INDEX `pantry_name_location_idx` ON `pantry_items` (`normalized_name`,`storage_location`);
