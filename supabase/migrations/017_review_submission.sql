-- ============================================================
-- KedaiOps — review_submission RPC
-- Bypasses RLS so both supervisor and owner can approve/reject
-- submissions without being blocked by any row-level policy.
-- ============================================================

-- Explicit table-level grants so anon can perform CRUD even
-- if default Supabase grants were ever tightened.
GRANT SELECT, INSERT, UPDATE ON public.submissions TO anon, authenticated;

-- Drop old permissive-only policies and replace with a clean set
DROP POLICY IF EXISTS "submissions_read"   ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update" ON public.submissions;

CREATE POLICY "submissions_read"   ON public.submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert" ON public.submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "submissions_update" ON public.submissions FOR UPDATE USING (true) WITH CHECK (true);

-- SECURITY DEFINER function — runs as the function owner (postgres),
-- sidestepping any RLS policy that might silently block anon UPDATEs.
CREATE OR REPLACE FUNCTION public.review_submission(
  p_id      uuid,
  p_status  text,
  p_comment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.submissions
     SET status             = p_status,
         supervisor_comment = p_comment
   WHERE id = p_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_submission(uuid, text, text) TO anon, authenticated;
