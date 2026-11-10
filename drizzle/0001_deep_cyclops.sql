PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_curios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cost_cents` integer NOT NULL,
	`date_acquired` integer,
	`relinquished` integer DEFAULT false NOT NULL,
	`date_relinquished` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_curios`("id", "user_id", "name", "description", "cost_cents", "date_acquired", "relinquished", "date_relinquished", "created_at") SELECT "id", "user_id", "name", "description", "cost_cents", "date_acquired", "relinquished", "date_relinquished", "created_at" FROM `curios`;--> statement-breakpoint
DROP TABLE `curios`;--> statement-breakpoint
ALTER TABLE `__new_curios` RENAME TO `curios`;--> statement-breakpoint
PRAGMA foreign_keys=ON;