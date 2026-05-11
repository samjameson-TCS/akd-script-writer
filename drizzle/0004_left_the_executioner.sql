CREATE TABLE `lawsuit_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lawsuitKey` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`summary` text NOT NULL,
	`url` varchar(1024) NOT NULL,
	`publishedAt` varchar(64),
	`scrapedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lawsuit_updates_id` PRIMARY KEY(`id`)
);
