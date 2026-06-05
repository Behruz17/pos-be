-- Migration: 2026-06-03-add-customer-index-to-sale-drafts
-- Adds an index for fetching multiple sale drafts for a specific customer.

ALTER TABLE `sale_drafts`
  ADD KEY `idx_sale_drafts_customer_id` (`customer_id`);
