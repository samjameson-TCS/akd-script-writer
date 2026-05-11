CREATE TABLE `script_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`scriptName` varchar(256) NOT NULL,
	`comment` text NOT NULL,
	`promoted` int NOT NULL DEFAULT 0,
	`kbRule` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `script_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `feedback_entries` ADD `scope` enum('session','global') DEFAULT 'session' NOT NULL;