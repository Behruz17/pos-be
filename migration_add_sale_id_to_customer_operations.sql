-- Migration to add sale_id column to customer_operations table
-- This will link customer operations to specific sales for better traceability

ALTER TABLE `customer_operations` 
ADD COLUMN `sale_id` INT NULL AFTER `store_id`;

-- Add foreign key constraint
ALTER TABLE `customer_operations` 
ADD CONSTRAINT `fk_customer_operations_sale` 
FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL;

-- Add index for better performance
ALTER TABLE `customer_operations` 
ADD INDEX `idx_sale_id` (`sale_id`);

-- Update existing records to link to sales where possible
-- This is a best-effort attempt based on customer_id, store_id, and amount matching
UPDATE customer_operations co
JOIN sales s ON co.customer_id = s.customer_id 
    AND co.store_id = s.store_id 
    AND co.sum = s.total_amount
    AND DATE(co.date) = DATE(s.created_at)
    AND co.sale_id IS NULL
SET co.sale_id = s.id
WHERE co.type IN ('PAID', 'DEBT');