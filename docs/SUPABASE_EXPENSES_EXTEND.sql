-- Extend accounting_transactions for richer expense tracking
-- Run after supabase-migrations-accounting.sql
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Add vendor/supplier and campaign context for expenses
ALTER TABLE accounting_transactions
  ADD COLUMN IF NOT EXISTS vendor TEXT,
  ADD COLUMN IF NOT EXISTS campaign TEXT;

-- Optional: add common expense categories (run if you have none)
-- INSERT INTO accounting_categories (name, kind, code, description) VALUES
--   ('Campaign - Online', 'expense', 'CAMP-ONLINE', 'Ads, influencers, Meta, Google'),
--   ('Campaign - Offline', 'expense', 'CAMP-OFFLINE', 'Events, pop-ups, print, signage'),
--   ('Materials - Packaging', 'expense', 'MAT-PKG', 'Bottles, boxes, labels, caps'),
--   ('Materials - Raw', 'expense', 'MAT-RAW', 'Oils, ethanol, diluents'),
--   ('Operations', 'expense', 'OPS', 'Rent, utilities, shipping, admin'),
--   ('Other', 'expense', 'OTHER', 'Miscellaneous');
