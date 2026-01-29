-- Migration to add warehouse_id to suppliers table
-- Adds warehouse_id column as mandatory field to suppliers table

-- First, add the column as nullable
ALTER TABLE suppliers 
ADD COLUMN warehouse_id INT NULL;

-- Update existing supplier records with a valid warehouse_id (assuming warehouse ID 1 exists)
-- You may need to adjust this ID based on your actual warehouse data
UPDATE suppliers SET warehouse_id = 1;

-- Add the foreign key constraint
ALTER TABLE suppliers 
ADD CONSTRAINT fk_suppliers_warehouse 
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

-- Make the column non-nullable
ALTER TABLE suppliers MODIFY COLUMN warehouse_id INT NOT NULL;