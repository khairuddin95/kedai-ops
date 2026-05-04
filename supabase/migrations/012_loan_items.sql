-- ============================================================
-- KedaiOps — Loan Items (pinjaman item antara cawangan)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loan_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name        text NOT NULL,
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  from_branch      text NOT NULL,
  to_branch        text NOT NULL,
  reason           text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','returned')),
  requested_by_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_by_name text NOT NULL,
  requested_by_avatar text NOT NULL DEFAULT '👤',
  approved_by_name  text,
  due_date          date,
  notes             text,
  requested_at      timestamptz DEFAULT now(),
  approved_at       timestamptz,
  returned_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_loan_status      ON public.loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_loan_from_branch ON public.loan_requests(from_branch);
CREATE INDEX IF NOT EXISTS idx_loan_to_branch   ON public.loan_requests(to_branch);
CREATE INDEX IF NOT EXISTS idx_loan_requested   ON public.loan_requests(requested_at DESC);

ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan_read"   ON public.loan_requests FOR SELECT USING (true);
CREATE POLICY "loan_insert" ON public.loan_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "loan_update" ON public.loan_requests FOR UPDATE USING (true);
CREATE POLICY "loan_delete" ON public.loan_requests FOR DELETE USING (true);
