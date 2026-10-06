CREATE TABLE `categories` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`icon` varchar(50),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`group_id` int unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(191),
	`amount` decimal(10,2) NOT NULL,
	`pay_token` char(43) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `group_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_members_payToken_unique` UNIQUE(`pay_token`)
);
--> statement-breakpoint
CREATE TABLE `member_payments` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`member_id` int unsigned NOT NULL,
	`period` char(7) NOT NULL,
	`status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid',
	`paid_at` datetime,
	`reminded_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `member_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_payments_member_period_uq` UNIQUE(`member_id`,`period`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`user_id` int unsigned NOT NULL,
	`user_subscription_id` int unsigned,
	`type` enum('billing_reminder','trial_ending','member_reminder','test') NOT NULL,
	`channel` enum('email','in_app') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` varchar(1000) NOT NULL,
	`link` varchar(300),
	`due_date` date,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` tinyint NOT NULL DEFAULT 0,
	`read_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_dedupe_uq` UNIQUE(`user_subscription_id`,`type`,`due_date`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`service_id` int unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`billing_cycle` enum('monthly','yearly') NOT NULL,
	`max_members` tinyint NOT NULL DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`plan_id` int unsigned NOT NULL,
	`old_price` decimal(10,2) NOT NULL,
	`new_price` decimal(10,2) NOT NULL,
	`changed_by` int unsigned,
	`changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`category_id` int unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`logo_url` varchar(500),
	`website_url` varchar(500),
	`cancel_steps` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `share_groups` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`owner_id` int unsigned NOT NULL,
	`user_subscription_id` int unsigned NOT NULL,
	`name` varchar(100) NOT NULL,
	`promptpay_id` varchar(20) NOT NULL,
	`split_mode` enum('equal','custom') NOT NULL DEFAULT 'equal',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `share_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_groups_userSubscriptionId_unique` UNIQUE(`user_subscription_id`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`user_id` int unsigned NOT NULL,
	`plan_id` int unsigned,
	`custom_name` varchar(100),
	`custom_category_id` int unsigned,
	`price` decimal(10,2) NOT NULL,
	`billing_cycle` enum('monthly','yearly') NOT NULL,
	`next_billing_date` date NOT NULL,
	`billing_anchor_day` tinyint NOT NULL,
	`trial_ends_at` date,
	`payment_method` varchar(100),
	`note` varchar(500),
	`status` enum('active','cancelled') NOT NULL DEFAULT 'active',
	`cancelled_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(191) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`notify_enabled` boolean NOT NULL DEFAULT true,
	`notify_days_before` tinyint NOT NULL DEFAULT 3,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_share_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `share_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_payments` ADD CONSTRAINT `member_payments_member_id_group_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_subscription_id_user_subscriptions_id_fk` FOREIGN KEY (`user_subscription_id`) REFERENCES `user_subscriptions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `plans` ADD CONSTRAINT `plans_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_groups` ADD CONSTRAINT `share_groups_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_groups` ADD CONSTRAINT `share_groups_user_subscription_id_user_subscriptions_id_fk` FOREIGN KEY (`user_subscription_id`) REFERENCES `user_subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_custom_category_id_categories_id_fk` FOREIGN KEY (`custom_category_id`) REFERENCES `categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_user_channel_read_idx` ON `notifications` (`user_id`,`channel`,`read_at`);--> statement-breakpoint
CREATE INDEX `price_history_plan_changed_idx` ON `price_history` (`plan_id`,`changed_at`);--> statement-breakpoint
CREATE INDEX `services_category_active_idx` ON `services` (`category_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_user_status_idx` ON `user_subscriptions` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `user_subscriptions_status_next_idx` ON `user_subscriptions` (`status`,`next_billing_date`);