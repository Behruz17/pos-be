-- Migration to add store_id column to users table
-- This will enable store-scoped user access control

ALTER TABLE `users` 
ADD COLUMN `store_id` int NULL AFTER `role`;

-- Add foreign key constraint to ensure data integrity
ALTER TABLE `users` 
ADD CONSTRAINT `fk_users_store` 
FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL;

-- Add index for better query performance
ALTER TABLE `users` 
ADD INDEX `idx_store_id` (`store_id`);

-- Update existing users - you should customize this based on your business logic
-- For now, assigning all existing users to store ID 1 as an example
-- You should update this with appropriate store assignments for each user
UPDATE `users` 
SET `store_id` = 1 
WHERE `store_id` IS NULL;

-- Alternative approach: Set all existing users to NULL initially
-- and require explicit store assignment for new users
-- Uncomment the line below if you prefer this approach:
-- UPDATE `users` SET `store_id` = NULL WHERE `store_id` IS NULL;