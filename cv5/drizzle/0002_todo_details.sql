ALTER TABLE `todos`
ADD COLUMN `description` text NOT NULL DEFAULT '';

ALTER TABLE `todos`
ADD COLUMN `created_at` integer NOT NULL DEFAULT 0;

ALTER TABLE `todos`
ADD COLUMN `updated_at` integer NOT NULL DEFAULT 0;

UPDATE `todos`
SET `created_at` = CAST(strftime('%s', 'now') AS integer)
WHERE `created_at` = 0;

UPDATE `todos`
SET `updated_at` = CAST(strftime('%s', 'now') AS integer)
WHERE `updated_at` = 0;
