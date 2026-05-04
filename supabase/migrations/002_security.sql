-- ============================================================
-- KedaiOps — Username/Password Auth + RLS
-- Run this in Supabase SQL Editor
-- NOTE: PINs already bcrypt-hashed from previous migration attempt.
--       This script moves them to password_hash and adds usernames.
-- ============================================================

-- ── Step 1: Add new columns (safe to re-run) ─────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username      text,
  ADD COLUMN IF NOT EXISTS password_hash text;

-- ── Step 2: Copy existing bcrypt hash (pin) → password_hash ──
UPDATE public.users
SET password_hash = pin
WHERE password_hash IS NULL;

-- ── Step 3: Derive usernames from name ───────────────────────
UPDATE public.users
SET username = lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL;

-- ── Step 4: Enforce NOT NULL + unique username ────────────────
ALTER TABLE public.users
  ALTER COLUMN username      SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_username_unique;
ALTER TABLE public.users
  ADD CONSTRAINT users_username_unique UNIQUE (username);

-- ── Step 5: Drop old pin column (CASCADE drops dependent policies) ──
ALTER TABLE public.users
  DROP COLUMN IF EXISTS pin CASCADE;

-- ── Step 6: RPC — Login ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.login_by_credentials(
  p_username text,
  p_password text
)
RETURNS SETOF public.users
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT * FROM public.users
  WHERE username = lower(trim(p_username))
    AND password_hash = crypt(p_password, password_hash)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.login_by_credentials(text, text) TO anon, authenticated;

-- ── Step 7: RPC — Register new staff ─────────────────────────
CREATE OR REPLACE FUNCTION public.register_user(
  p_name     text,
  p_username text,
  p_password text,
  p_role     text,
  p_branch   text,
  p_avatar   text
)
RETURNS SETOF public.users
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO public.users (name, username, password_hash, role, branch, avatar)
  VALUES (
    p_name,
    lower(trim(p_username)),
    crypt(p_password, gen_salt('bf', 10)),
    p_role,
    p_branch,
    p_avatar
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text, text, text, text) TO anon, authenticated;

-- ── Step 8: Enable RLS ────────────────────────────────────────
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_states  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts       ENABLE ROW LEVEL SECURITY;

-- ── Step 9: RLS Policies ──────────────────────────────────────
DROP POLICY IF EXISTS "task_groups_read"  ON public.task_groups;
DROP POLICY IF EXISTS "task_groups_write" ON public.task_groups;
DROP POLICY IF EXISTS "tasks_read"        ON public.tasks;
DROP POLICY IF EXISTS "tasks_write"       ON public.tasks;
DROP POLICY IF EXISTS "shifts_read"       ON public.shifts;
DROP POLICY IF EXISTS "users_read"        ON public.users;
DROP POLICY IF EXISTS "users_delete"      ON public.users;
DROP POLICY IF EXISTS "submissions_read"   ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;
DROP POLICY IF EXISTS "task_states_all"   ON public.task_states;

CREATE POLICY "task_groups_read"  ON public.task_groups FOR SELECT USING (true);
CREATE POLICY "task_groups_write" ON public.task_groups FOR ALL    USING (true);
CREATE POLICY "tasks_read"        ON public.tasks       FOR SELECT USING (true);
CREATE POLICY "tasks_write"       ON public.tasks       FOR ALL    USING (true);
CREATE POLICY "shifts_read"       ON public.shifts      FOR SELECT USING (true);
CREATE POLICY "users_read"        ON public.users       FOR SELECT USING (true);
CREATE POLICY "users_delete"      ON public.users       FOR DELETE USING (true);
CREATE POLICY "submissions_read"   ON public.submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON public.submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "submissions_update" ON public.submissions FOR UPDATE USING (true);
CREATE POLICY "task_states_all"   ON public.task_states FOR ALL    USING (true);
