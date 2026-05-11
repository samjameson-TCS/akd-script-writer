CREATE TABLE `research_docs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lawsuitKey` varchar(64) NOT NULL,
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_docs_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_docs_lawsuitKey_unique` UNIQUE(`lawsuitKey`)
);
