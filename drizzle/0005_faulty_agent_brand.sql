CREATE TABLE `saved_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`lawsuit` varchar(64) NOT NULL,
	`hookCategory` varchar(64),
	`hookAngle` varchar(128),
	`hook` text NOT NULL,
	`body` text NOT NULL,
	`cta` text NOT NULL,
	`complianceLevel` int,
	`platform` varchar(64),
	`aggressiveScale` int,
	`sessionId` int,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_scripts_id` PRIMARY KEY(`id`)
);
