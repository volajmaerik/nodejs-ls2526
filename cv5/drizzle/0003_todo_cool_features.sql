ALTER TABLE `todos`
ADD COLUMN `tags` text NOT NULL DEFAULT '';

ALTER TABLE `todos`
ADD COLUMN `due_at` integer;

ALTER TABLE `todos`
ADD COLUMN `archived` integer NOT NULL DEFAULT 0;
