CREATE TABLE `feedback_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scriptId` int NOT NULL,
	`scriptName` varchar(128) NOT NULL,
	`feedbackText` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lawsuit` varchar(64) NOT NULL,
	`hookCategory` varchar(64) NOT NULL,
	`aggressiveScale` int NOT NULL,
	`avatar` varchar(64) NOT NULL,
	`referenceScript` text,
	`extraInstructions` text,
	`scripts` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kb_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kb_documents_id` PRIMARY KEY(`id`)
);
