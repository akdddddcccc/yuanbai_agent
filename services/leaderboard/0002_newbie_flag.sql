-- 新手标记：首次上榜 is_newbie=1，成绩进步被替换后置 0。
-- 已有记录默认 0（不显示新手标），保持不变。
ALTER TABLE `scores` ADD COLUMN `is_newbie` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `death_scores` ADD COLUMN `is_newbie` integer NOT NULL DEFAULT 0;
