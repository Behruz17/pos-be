-- Remove pieces_per_box column from products table
-- This field is not used anywhere in the application code
ALTER TABLE `products` 
DROP COLUMN `pieces_per_box`;