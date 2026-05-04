-- ============================================================
-- KedaiOps — Security Hardening
-- ============================================================

-- ── 1. Fix register_user: drop old 6-arg version, grant correct signature ──

-- Drop old 6-arg overload (used p_password — replaced by PIN flow)
DROP FUNCTION IF EXISTS public.register_user(text, text, text, text, text, text);

-- Re-create 5-arg version with role + username validation
CREATE OR REPLACE FUNCTION public.register_user(
  p_name     text,
  p_username text,
  p_role     text,
  p_branch   text,
  p_avatar   text
)
RETURNS SETOF public.users
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_role NOT IN ('staff', 'supervisor') THEN
    RAISE EXCEPTION 'Cannot create role: %', p_role;
  END IF;
  IF p_username !~ '^[a-z0-9._]{3,30}$' THEN
    RAISE EXCEPTION 'Invalid username format';
  END IF;
  RETURN QUERY
    INSERT INTO public.users (name, username, password_hash, role, branch, avatar, pin_set)
    VALUES (p_name, lower(trim(p_username)), NULL, p_role, p_branch, p_avatar, false)
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text, text, text) TO anon, authenticated;

-- ── 2. Drop old reset_user_password (no longer used — PIN-only login) ──
REVOKE EXECUTE ON FUNCTION public.reset_user_password(uuid, text) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.reset_user_password(uuid, text);

-- ── 3. Harden reset_user_pin: require branch as secondary confirmation ──
-- Prevents blind UUID-based resets — caller must know the target's branch.
DROP FUNCTION IF EXISTS public.reset_user_pin(uuid);
CREATE OR REPLACE FUNCTION public.reset_user_pin(p_user_id uuid, p_branch text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.users
     SET password_hash = NULL, pin_set = false
   WHERE id = p_user_id AND branch = p_branch;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_pin(uuid, text) TO anon, authenticated;

-- ── 4. PIN brute-force protection ──
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username     text        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pin_attempts_user_time
  ON public.pin_attempts(username, attempted_at DESC);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pin_attempts_insert" ON public.pin_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "pin_attempts_select" ON public.pin_attempts FOR SELECT USING (true);
CREATE POLICY "pin_attempts_delete" ON public.pin_attempts FOR DELETE USING (true);

-- verify_pin with lockout: 5 failures within 10 minutes → locked
DROP FUNCTION IF EXISTS public.verify_pin(text, text);
CREATE OR REPLACE FUNCTION public.verify_pin(p_username text, p_pin text)
RETURNS TABLE (
  id        uuid,
  name      text,
  avatar    text,
  role      text,
  branch    text,
  username  text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_failures int;
  v_user     public.users%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_failures
    FROM public.pin_attempts
   WHERE pin_attempts.username = lower(trim(p_username))
     AND attempted_at > now() - interval '10 minutes';

  IF v_failures >= 5 THEN
    RAISE EXCEPTION 'LOCKED: Too many failed attempts. Try again in 10 minutes.';
  END IF;

  SELECT * INTO v_user
    FROM public.users u
   WHERE u.username  = lower(trim(p_username))
     AND u.pin_set   = true
     AND u.password_hash = crypt(p_pin, u.password_hash)
   LIMIT 1;

  IF v_user IS NULL THEN
    INSERT INTO public.pin_attempts (username)
    VALUES (lower(trim(p_username)));
    RETURN;
  END IF;

  -- Success: clear failures
  DELETE FROM public.pin_attempts
   WHERE pin_attempts.username = lower(trim(p_username));

  RETURN QUERY
    SELECT v_user.id, v_user.name, v_user.avatar,
           v_user.role, v_user.branch, v_user.username;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO anon, authenticated;

-- ── 5. Hide password_hash from anon reads ──
-- Revoke the specific column rather than the whole table
-- (keeps all other db.ts SELECT queries working unchanged).
REVOKE SELECT (password_hash) ON public.users FROM anon, authenticated;
