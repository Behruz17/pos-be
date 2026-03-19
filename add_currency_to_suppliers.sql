-- Migration to add currency field to suppliers table
-- Run this query to add the currency field to existing suppliers table

ALTER TABLE suppliers 
ADD COLUMN currency ENUM('yuan', 'dollar', 'somoni') DEFAULT 'somoni' AFTER status;

-- Update existing suppliers to have somoni as default currency (they already have it by default)
UPDATE suppliers SET currency = 'somoni' WHERE currency IS NULL;
