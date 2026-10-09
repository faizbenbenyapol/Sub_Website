ALTER TABLE `notifications` MODIFY COLUMN `type` enum('billing_reminder','trial_ending','member_reminder','test','feedback_reply') NOT NULL;--> statement-breakpoint
ALTER TABLE `feedback` ADD `reply` text;--> statement-breakpoint
ALTER TABLE `feedback` ADD `replied_at` datetime;