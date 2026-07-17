-- =========================================================
-- Question Bank — persisted and editable
--
-- Until now the bank lived in src/lib/instruments.ts as a static constant:
-- rendered read-only, compiled into the bundle, impossible to edit. These
-- tables make it real data with full CRUD.
--
-- Shape deliberately mirrors survey_questions / survey_question_options
-- (same public.question_kind enum, same prompt_en/te + label_en/te columns) so
-- importing a bank item into a survey stays a straight column copy.
--
-- The legacy clinical tables (instruments, instrument_items, scales,
-- scale_options) are NOT touched or reused. The survey-engine migration
-- declared them "left in place, untouched, and unused by the app going
-- forward", and their model (canonical item_no, scoring keys, shared scale
-- rows) does not survive free-form admin editing. This bank is seeded from the
-- static file instead — the exact content the console renders today.
--
-- Idempotent: safe to re-run.
-- =========================================================

-- =========================================================
-- question_bank_instruments — the groups that hold questions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.question_bank_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_te text,
  blurb_en text,
  blurb_te text,
  source text,
  order_index int NOT NULL DEFAULT 0,
  -- true only for the 8 seeded research instruments. Custom instruments an
  -- admin creates are false and are never integrity-flagged.
  is_builtin boolean NOT NULL DEFAULT false,
  -- Item count at seed time. An added or removed item changes this count, which
  -- is how a built-in instrument is detected as diverging from its published
  -- form even when no individual item was edited. NULL for custom instruments.
  source_item_count int,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_instruments TO authenticated;
GRANT ALL ON public.question_bank_instruments TO service_role;
ALTER TABLE public.question_bank_instruments ENABLE ROW LEVEL SECURITY;

-- The bank is an authoring surface, not respondent-facing: no anon grant, and
-- every policy is gated on super_admin exactly like surveys/survey_questions.
DROP POLICY IF EXISTS "Bank instruments: super admin read" ON public.question_bank_instruments;
CREATE POLICY "Bank instruments: super admin read"
  ON public.question_bank_instruments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank instruments: super admin write" ON public.question_bank_instruments;
CREATE POLICY "Bank instruments: super admin write"
  ON public.question_bank_instruments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank instruments: super admin update" ON public.question_bank_instruments;
CREATE POLICY "Bank instruments: super admin update"
  ON public.question_bank_instruments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank instruments: super admin delete" ON public.question_bank_instruments;
CREATE POLICY "Bank instruments: super admin delete"
  ON public.question_bank_instruments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_qb_instruments_updated ON public.question_bank_instruments;
CREATE TRIGGER trg_qb_instruments_updated BEFORE UPDATE ON public.question_bank_instruments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_qb_instruments_order ON public.question_bank_instruments(order_index);

-- =========================================================
-- question_bank_items — the questions themselves
-- =========================================================
CREATE TABLE IF NOT EXISTS public.question_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES public.question_bank_instruments(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  kind public.question_kind NOT NULL DEFAULT 'short_text',
  prompt_en text NOT NULL,
  prompt_te text,
  required boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  -- Frozen copy of the item as seeded: {prompt_en, prompt_te, kind, options:[{label_en,label_te}]}.
  -- Diffing the live row against this is what powers the "Modified from source"
  -- badge and one-click Revert. NULL for custom items, which have no published
  -- form to diverge from.
  source_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_items TO authenticated;
GRANT ALL ON public.question_bank_items TO service_role;
ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bank items: super admin read" ON public.question_bank_items;
CREATE POLICY "Bank items: super admin read"
  ON public.question_bank_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank items: super admin write" ON public.question_bank_items;
CREATE POLICY "Bank items: super admin write"
  ON public.question_bank_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank items: super admin update" ON public.question_bank_items;
CREATE POLICY "Bank items: super admin update"
  ON public.question_bank_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank items: super admin delete" ON public.question_bank_items;
CREATE POLICY "Bank items: super admin delete"
  ON public.question_bank_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_qb_items_updated ON public.question_bank_items;
CREATE TRIGGER trg_qb_items_updated BEFORE UPDATE ON public.question_bank_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_qb_items_instrument ON public.question_bank_items(instrument_id, order_index);

-- =========================================================
-- question_bank_item_options — response choices for choice-kind items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.question_bank_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.question_bank_items(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  label_en text NOT NULL,
  label_te text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_item_options TO authenticated;
GRANT ALL ON public.question_bank_item_options TO service_role;
ALTER TABLE public.question_bank_item_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bank options: super admin read" ON public.question_bank_item_options;
CREATE POLICY "Bank options: super admin read"
  ON public.question_bank_item_options FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank options: super admin write" ON public.question_bank_item_options;
CREATE POLICY "Bank options: super admin write"
  ON public.question_bank_item_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank options: super admin update" ON public.question_bank_item_options;
CREATE POLICY "Bank options: super admin update"
  ON public.question_bank_item_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Bank options: super admin delete" ON public.question_bank_item_options;
CREATE POLICY "Bank options: super admin delete"
  ON public.question_bank_item_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_qb_options_item ON public.question_bank_item_options(item_id, order_index);

-- =========================================================
-- Reorder helper — one statement instead of N round-trips, so a drag never
-- leaves the list half-renumbered if the client dies mid-flight.
-- =========================================================
CREATE OR REPLACE FUNCTION public.reorder_question_bank_items(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.question_bank_items q
     SET order_index = new_order.idx
    FROM (SELECT unnest(p_ids) AS id, generate_subscripts(p_ids, 1) - 1 AS idx) AS new_order
   WHERE q.id = new_order.id;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_question_bank_items(uuid[]) TO authenticated;
