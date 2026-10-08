ALTER TABLE `users` MODIFY COLUMN `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `google_sub` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_googleSub_unique` UNIQUE(`google_sub`);