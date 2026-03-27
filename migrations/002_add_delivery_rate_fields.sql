-- Add rate and converted_sum fields to delivery_operations table
-- Migration: 2026-03-24-add-delivery-rate-fields

ALTER TABLE `delivery_operations` 
ADD COLUMN `rate` decimal(10,4) DEFAULT NULL COMMENT 'Курс валюты для конвертации',
ADD COLUMN `converted_sum` decimal(10,2) DEFAULT NULL COMMENT 'Сконвертированная сумма (sum / rate)';
