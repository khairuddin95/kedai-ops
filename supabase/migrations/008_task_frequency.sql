-- ============================================================
-- KedaiOps — Task group frequency (daily / weekly)
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.task_groups
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily'
  CHECK (frequency IN ('daily', 'weekly'));
