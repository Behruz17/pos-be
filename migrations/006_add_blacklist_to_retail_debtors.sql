-- Migration 006: Add blacklist fields to retail_debtors table
-- Allows marking retail debtors as blacklisted with an optional reason

ALTER TABLE `retail_debtors`
  ADD COLUMN `is_blacklisted` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Флаг чёрного списка',
  ADD COLUMN `blacklist_reason` TEXT NULL DEFAULT NULL
    COMMENT 'Причина добавления в чёрный список';
