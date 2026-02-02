-- Migration: add retail_debtor_id to returns
ALTER TABLE `returns`
  ADD COLUMN `retail_debtor_id` int DEFAULT NULL AFTER `customer_id`;

-- Add index
ALTER TABLE `returns`
  ADD KEY `retail_debtor_id` (`retail_debtor_id`);

-- Add foreign key constraint (assumes table `retail_debtors` exists)
ALTER TABLE `returns`
  ADD CONSTRAINT `returns_ibfk_4` FOREIGN KEY (`retail_debtor_id`) REFERENCES `retail_debtors` (`id`) ON DELETE SET NULL;
