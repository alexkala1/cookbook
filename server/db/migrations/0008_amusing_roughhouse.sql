CREATE INDEX `cooking_sessions_recipe_id_idx` ON `cooking_sessions` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `grocery_items_list_id_idx` ON `grocery_items` (`list_id`);--> statement-breakpoint
CREATE INDEX `recipes_parent_recipe_id_idx` ON `recipes` (`parent_recipe_id`);--> statement-breakpoint
CREATE INDEX `recipes_created_at_idx` ON `recipes` (created_at DESC,`id`);