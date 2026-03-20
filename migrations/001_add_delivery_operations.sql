-- Migration: Create delivery_operations table
-- This table tracks all financial operations related to delivery drivers

-- Create delivery_operations table
CREATE TABLE IF NOT EXISTS `delivery_operations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `delivery_driver_id` INT NOT NULL,
  `stock_receipt_id` INT DEFAULT NULL,
  `sum` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(20) DEFAULT NULL,
  `type` ENUM('RECEIPT','PAYMENT') NOT NULL,
  `note` TEXT DEFAULT NULL,
  `date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_driver_id` (`delivery_driver_id`),
  KEY `idx_receipt_id` (`stock_receipt_id`),
  KEY `idx_type` (`type`),
  KEY `idx_date` (`date`),
  CONSTRAINT `fk_delivery_operations_driver` FOREIGN KEY (`delivery_driver_id`) REFERENCES `delivery_drivers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_delivery_operations_receipt` FOREIGN KEY (`stock_receipt_id`) REFERENCES `stock_receipts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing data: Create RECEIPT operations for existing stock receipts with delivery drivers
INSERT INTO `delivery_operations` (`delivery_driver_id`, `stock_receipt_id`, `sum`, `currency`, `type`, `date`)
SELECT 
  sr.`delivery_driver_id`,
  sr.`id`,
  0.00,
  NULL,
  'RECEIPT',
  sr.`created_at`
FROM `stock_receipts` sr
WHERE sr.`delivery_driver_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `delivery_operations` do 
    WHERE do.`stock_receipt_id` = sr.`id`
  );
