-- ============================================================
-- KedaiOps — Branch Management Table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  address    text,
  phone      text,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reuse touch_updated_at from 003_assets.sql (already exists)
DROP TRIGGER IF EXISTS branches_updated_at ON public.branches;
CREATE TRIGGER branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_read"  ON public.branches;
DROP POLICY IF EXISTS "branches_write" ON public.branches;

CREATE POLICY "branches_read"  ON public.branches FOR SELECT USING (true);
CREATE POLICY "branches_write" ON public.branches FOR ALL    USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO anon, authenticated;

-- Seed existing branches from users table (deduplicated)
INSERT INTO public.branches (name, status)
SELECT DISTINCT branch, 'active'
FROM public.users
WHERE branch IS NOT NULL AND branch <> ''
ON CONFLICT (name) DO NOTHING;
