-- ============================================================
-- KedaiOps — Google Review Logs
-- Moves Google Review evidence from localStorage to DB so
-- supervisor/owner can approve/reject staff photo submissions
-- with real-time visibility.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.google_review_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  staff_name       text        NOT NULL,
  staff_avatar     text        NOT NULL DEFAULT '👤',
  branch           text        NOT NULL,
  photo_url        text        NOT NULL,
  logged_at        timestamptz NOT NULL DEFAULT now(),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_name text,
  supervisor_note  text,
  reviewed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_gr_logs_branch_date
  ON public.google_review_logs (branch, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_gr_logs_staff
  ON public.google_review_logs (staff_id, logged_at DESC);

ALTER TABLE public.google_review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gr_logs_all" ON public.google_review_logs
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.google_review_logs TO anon, authenticated;

-- SECURITY DEFINER so RLS cannot block supervisor/owner reviews
CREATE OR REPLACE FUNCTION public.review_google_log(
  p_id            uuid,
  p_status        text,
  p_reviewer_name text,
  p_note          text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.google_review_logs
     SET status           = p_status,
         reviewed_by_name = p_reviewer_name,
         supervisor_note  = p_note,
         reviewed_at      = now()
   WHERE id = p_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_google_log(uuid, text, text, text)
  TO anon, authenticated;
