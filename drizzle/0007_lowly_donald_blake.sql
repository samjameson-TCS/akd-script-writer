CREATE TABLE `buyer_specs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyerName` varchar(128) NOT NULL,
	`buyerCode` varchar(32),
	`lawsuitKeys` text,
	`content` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buyer_specs_id` PRIMARY KEY(`id`),
	CONSTRAINT `buyer_specs_buyerName_unique` UNIQUE(`buyerName`)
);
