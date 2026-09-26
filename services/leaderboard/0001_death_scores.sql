CREATE TABLE `death_scores` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL,
  `run_id` text NOT NULL,
  `rule_version` text NOT NULL,
  `nickname` text NOT NULL,
  `deaths` integer NOT NULL,
  `duration_ms` integer NOT NULL,
  `steps` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_death_scores_player_version` ON `death_scores` (`player_id`,`rule_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_death_scores_run` ON `death_scores` (`run_id`);
--> statement-breakpoint
CREATE INDEX `idx_death_scores_ranking` ON `death_scores` (`rule_version`,`deaths` DESC,`duration_ms`,`steps`,`created_at`);
