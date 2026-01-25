-- Add notification threshold column to products table
ALTER TABLE `products` 
ADD COLUMN `notification_threshold` INT NOT NULL DEFAULT 10 AFTER `pieces_per_box`;