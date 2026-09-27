CREATE TABLE `nickname_claims` (
  `rule_version` text NOT NULL,
  `nickname_key` text NOT NULL,
  `nickname` text NOT NULL,
  `player_id` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`rule_version`,`nickname_key`),
  UNIQUE (`rule_version`,`player_id`)
);
--> statement-breakpoint
-- Claim existing names in first-submission order. INSERT OR IGNORE lets an old
-- duplicated nickname keep one owner without making deployment fail.
INSERT OR IGNORE INTO nickname_claims (rule_version,nickname_key,nickname,player_id,created_at)
SELECT rule_version,lower(trim(nickname)),nickname,player_id,created_at
FROM scores
ORDER BY created_at ASC,id ASC;
