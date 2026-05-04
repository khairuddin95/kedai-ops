-- ============================================================
-- KedaiOps — Telegram bot support
-- Run this in Supabase SQL Editor
-- ============================================================

-- telegram_id: Telegram chat ID (staff self-register via /daftar)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telegram_id text;

CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id_unique
  ON public.users(telegram_id)
  WHERE telegram_id IS NOT NULL;
