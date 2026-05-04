-- ============================================================
-- KedaiOps — Edit Staff Support
-- Run this in Supabase SQL Editor
-- ============================================================

-- RPC — Reset a user's password (owner/supervisor action)
-- Hashes the new password server-side; plain text never stored.
CREATE OR REPLACE FUNCTION public.reset_user_password(
  p_user_id     uuid,
  p_new_password text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE public.users
  SET password_hash = crypt(p_new_password, gen_salt('bf', 10))
  WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_password(uuid, text) TO anon, authenticated;

-- Allow UPDATE on users table (for name/role/branch/avatar changes)
-- The existing "users_read" SELECT policy already exists.
-- Add an UPDATE policy so the anon/authenticated role can update rows.
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true);
