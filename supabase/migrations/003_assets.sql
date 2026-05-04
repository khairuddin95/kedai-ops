-- ============================================================
-- KedaiOps — Asset Inventory Table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  category     text        NOT NULL,
  quantity     integer     NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  condition    text        NOT NULL DEFAULT 'good' CHECK (condition IN ('good','fair','poor')),
  branch       text        NOT NULL,
  notes        text,
  last_checked date        DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS assets_updated_at ON public.assets;
CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Index for fast branch/category lookups
CREATE INDEX IF NOT EXISTS assets_branch_idx    ON public.assets (branch);
CREATE INDEX IF NOT EXISTS assets_category_idx  ON public.assets (category);
CREATE INDEX IF NOT EXISTS assets_condition_idx ON public.assets (condition);

-- RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_read"   ON public.assets;
DROP POLICY IF EXISTS "assets_write"  ON public.assets;
DROP POLICY IF EXISTS "assets_delete" ON public.assets;

CREATE POLICY "assets_read"   ON public.assets FOR SELECT USING (true);
CREATE POLICY "assets_write"  ON public.assets FOR ALL    USING (true);

-- Grant to anon + authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO anon, authenticated;
