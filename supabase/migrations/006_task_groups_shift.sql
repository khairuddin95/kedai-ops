-- ============================================================
-- KedaiOps — Add shift column to task_groups
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.task_groups
  ADD COLUMN IF NOT EXISTS shift text NOT NULL DEFAULT 'both'
  CHECK (shift IN ('morning', 'evening', 'both'));
