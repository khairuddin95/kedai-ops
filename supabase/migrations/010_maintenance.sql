-- ============================================================
-- KedaiOps — Maintenance Reports
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  category            text NOT NULL DEFAULT 'equipment'
    CHECK (category IN ('equipment','facility','electrical','plumbing','other')),
  description         text NOT NULL DEFAULT '',
  priority            text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  status              text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved')),
  reported_by_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_by_name    text NOT NULL,
  reported_by_avatar  text NOT NULL DEFAULT '👤',
  branch              text NOT NULL,
  reported_at         timestamptz DEFAULT now(),
  resolved_at         timestamptz,
  supervisor_notes    text
);

CREATE INDEX IF NOT EXISTS idx_maint_status   ON public.maintenance_reports(status);
CREATE INDEX IF NOT EXISTS idx_maint_branch   ON public.maintenance_reports(branch);
CREATE INDEX IF NOT EXISTS idx_maint_reported ON public.maintenance_reports(reported_at DESC);

ALTER TABLE public.maintenance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maint_read"   ON public.maintenance_reports FOR SELECT USING (true);
CREATE POLICY "maint_insert" ON public.maintenance_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "maint_update" ON public.maintenance_reports FOR UPDATE USING (true);
CREATE POLICY "maint_delete" ON public.maintenance_reports FOR DELETE USING (true);
