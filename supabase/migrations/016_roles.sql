-- 016_roles.sql — Custom roles with configurable feature permissions
-- Owner can define named role templates (e.g. "Ketua Dapur") and assign them
-- to staff/supervisor users, overriding their default page access.

-- ── custom_roles table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text    NOT NULL,
  base_role  text    NOT NULL DEFAULT 'staff'
             CHECK (base_role IN ('staff', 'supervisor')),
  features   text[]  NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_read"  ON public.custom_roles;
DROP POLICY IF EXISTS "cr_write" ON public.custom_roles;
CREATE POLICY "cr_read"  ON public.custom_roles FOR SELECT USING (true);
CREATE POLICY "cr_write" ON public.custom_roles FOR ALL    USING (true);

-- ── FK on users ─────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_role_id uuid
  REFERENCES public.custom_roles(id)
  ON DELETE SET NULL;
