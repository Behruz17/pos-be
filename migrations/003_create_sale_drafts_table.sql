-- Migration: 2026-03-28-create-sale-drafts-table
-- Creates the sale_drafts table used by the sales draft endpoints.

DROP TABLE IF EXISTS `sale_drafts`;
CREATE TABLE `sale_drafts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `store_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `items` text NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_status` enum('UNPAID','PAID','DEBT') NOT NULL DEFAULT 'UNPAID',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sale_drafts_user_id` (`user_id`),
  KEY `idx_sale_drafts_store_id` (`store_id`),
  KEY `idx_sale_drafts_warehouse_id` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
