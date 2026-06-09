-- Migration 005: Add debt_deadline column to retail_debtors table
-- This allows setting a payment deadline for retail debtors

ALTER TABLE `retail_debtors`
  ADD COLUMN `debt_deadline` DATE NULL DEFAULT NULL
  COMMENT 'Дедлайн долга — дата, до которой должник обязан погасить задолженность';
