-- Add store_id column to expenses table
ALTER TABLE `expenses` 
ADD COLUMN `store_id` int NOT NULL AFTER `comment`;

-- Add foreign key constraint
ALTER TABLE `expenses` 
ADD CONSTRAINT `fk_expenses_store` 
FOREIGN KEY (`store_id`) 
REFERENCES `stores` (`id`) 
ON DELETE CASCADE;