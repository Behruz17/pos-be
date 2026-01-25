-- Migration script to add receipt_id column to supplier_operations table
-- This script adds the receipt_id column and foreign key constraint to existing database

-- Add the receipt_id column to supplier_operations table
ALTER TABLE `supplier_operations` 
ADD COLUMN `receipt_id` int DEFAULT NULL AFTER `warehouse_id`;

-- Add foreign key constraint for receipt_id
ALTER TABLE `supplier_operations`
ADD CONSTRAINT `supplier_operations_ibfk_3` 
FOREIGN KEY (`receipt_id`) REFERENCES `stock_receipts` (`id`) ON DELETE SET NULL;

-- Add index for better query performance on receipt_id
ALTER TABLE `supplier_operations` 
ADD INDEX `idx_receipt_id` (`receipt_id`);

-- Populate existing supplier operations with corresponding receipt_id
-- Only populate for 'RECEIPT' type operations as PAYMENT operations don't have associated receipts
-- Match by supplier_id, warehouse_id, and approximate date (within 24 hours)
UPDATE supplier_operations so
JOIN stock_receipts sr ON so.supplier_id = sr.supplier_id 
    AND so.warehouse_id = sr.warehouse_id 
    AND ABS(TIMESTAMPDIFF(HOUR, so.date, sr.created_at)) <= 24
SET so.receipt_id = sr.id
WHERE so.type = 'RECEIPT' 
    AND so.receipt_id IS NULL;

-- Verify the migration
SELECT 
    COUNT(*) as total_operations,
    COUNT(receipt_id) as operations_with_receipt_id,
    COUNT(CASE WHEN type = 'RECEIPT' THEN 1 END) as receipt_operations,
    COUNT(CASE WHEN type = 'RECEIPT' AND receipt_id IS NOT NULL THEN 1 END) as receipt_operations_linked,
    COUNT(CASE WHEN type = 'PAYMENT' THEN 1 END) as payment_operations,
    COUNT(CASE WHEN type = 'PAYMENT' AND receipt_id IS NOT NULL THEN 1 END) as payment_operations_with_receipt_id
FROM supplier_operations;
