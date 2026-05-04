-- Replace register_user: no longer requires a password.
-- Staff set their own PIN on first login (pin_set = false by default).
CREATE OR REPLACE FUNCTION public.register_user(
  p_name     text,
  p_username text,
  p_role     text,
  p_branch   text,
  p_avatar   text
)
RETURNS SETOF public.users
LANGUAGE sql SECURITY DEFINER
AS $$
  INSERT INTO public.users (name, username, password_hash, role, branch, avatar, pin_set)
  VALUES (
    p_name,
    lower(trim(p_username)),
    NULL,
    p_role,
    p_branch,
    p_avatar,
    false
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text, text, text, text) TO anon, authenticated;

-- Allow password_hash to be NULL (existing rows with hashes are unaffected)
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Reset a staff member's PIN so they are prompted to set a new one on next login
CREATE OR REPLACE FUNCTION public.reset_user_pin(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE public.users
  SET password_hash = NULL, pin_set = false
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_pin(uuid) TO anon, authenticated;
