-- Migration to add store_id column to customers table
-- This will enable store-scoped customer management and filtering

ALTER TABLE `customers` 
ADD COLUMN `store_id` int NULL AFTER `city`;

-- Add foreign key constraint to ensure data integrity
ALTER TABLE `customers` 
ADD CONSTRAINT `fk_customers_store` 
FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL;

-- Add index for better query performance
ALTER TABLE `customers` 
ADD INDEX `idx_store_id` (`store_id`);

-- Update existing customers to have a default store_id
-- This is a placeholder - you should update this with appropriate business logic
-- For example, you might want to assign existing customers to a specific store
-- or set them to NULL initially and require explicit assignment
UPDATE `customers` 
SET `store_id` = 1 
WHERE `store_id` IS NULL;

-- Alternative approach: Set all existing customers to NULL initially
-- and require explicit store assignment for new customers
-- Uncomment the line below if you prefer this approach:
-- UPDATE `customers` SET `store_id` = NULL WHERE `store_id` IS NULL;