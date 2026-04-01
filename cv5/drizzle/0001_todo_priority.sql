ALTER TABLE `todos`
ADD COLUMN `priority` text NOT NULL DEFAULT 'normal' CHECK (`priority` IN ('normal', 'low', 'high'));
