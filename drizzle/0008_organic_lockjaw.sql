CREATE TABLE `hooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hookLine` text NOT NULL,
	`category` varchar(64) NOT NULL,
	`source` varchar(128),
	`lawsuitKey` varchar(64),
	`isWinning` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hooks_id` PRIMARY KEY(`id`)
);
