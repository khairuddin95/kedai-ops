-- ============================================================
-- KedaiOps — PIN-based login
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add pin_set flag (tracks whether user has set their PIN)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pin_set boolean NOT NULL DEFAULT false;

-- 2. Force all existing users to set a new PIN on next login
UPDATE public.users SET pin_set = false;

-- 3. check_username: return user preview for login step 1
DROP FUNCTION IF EXISTS public.check_username(text);
CREATE OR REPLACE FUNCTION public.check_username(p_username text)
RETURNS TABLE (
  id        uuid,
  name      text,
  avatar    text,
  role      text,
  branch    text,
  username  text,
  pin_set   boolean
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    u.id,
    u.name,
    u.avatar,
    u.role,
    u.branch,
    u.username,
    u.pin_set
  FROM public.users u
  WHERE u.username = lower(trim(p_username))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_username(text) TO anon, authenticated;

-- 4. set_user_pin: hash PIN with bcrypt, mark pin_set = true, return user
-- Uses a CTE so UPDATE + RETURNING happens in one SQL statement (avoids plpgsql
-- variable-shadowing: RETURNS TABLE columns named "username" would shadow the
-- table column in a WHERE clause if written in plpgsql).
DROP FUNCTION IF EXISTS public.set_user_pin(text, text);
CREATE OR REPLACE FUNCTION public.set_user_pin(p_username text, p_pin text)
RETURNS TABLE (
  id        uuid,
  name      text,
  avatar    text,
  role      text,
  branch    text,
  username  text
)
LANGUAGE sql SECURITY DEFINER
AS $$
  WITH updated AS (
    UPDATE public.users
    SET
      password_hash = crypt(p_pin, gen_salt('bf', 10)),
      pin_set       = true
    WHERE users.username = lower(trim(p_username))
    RETURNING users.id, users.name, users.avatar, users.role, users.branch, users.username
  )
  SELECT * FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(text, text) TO anon, authenticated;

-- 5. verify_pin: check PIN against bcrypt hash, return user on success
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
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT u.id, u.name, u.avatar, u.role, u.branch, u.username
  FROM public.users u
  WHERE u.username = lower(trim(p_username))
    AND u.pin_set = true
    AND u.password_hash = crypt(p_pin, u.password_hash)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO anon, authenticated;
