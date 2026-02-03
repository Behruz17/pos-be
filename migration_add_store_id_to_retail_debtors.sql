-- Add store_id to retail_debtors so retail debtors are per-store
ALTER TABLE retail_debtors
  ADD COLUMN store_id INT NULL;

-- Optionally add foreign key if `stores` table exists
ALTER TABLE retail_debtors
  ADD CONSTRAINT `retail_debtors_store_id_fk` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL;
