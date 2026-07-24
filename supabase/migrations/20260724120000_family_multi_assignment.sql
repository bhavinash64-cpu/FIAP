-- ============================================================================
-- Assign a family MORE THAN ONE instrument, each opening on a date the officer
-- picks.
--
-- What already existed: the longitudinal follow-up chain (20260722180000) —
-- the SAME instrument, repeated on a fixed cadence (30/90/180/365 days). That
-- answers "measure this family again later". It cannot answer "this family
-- should also do the Internet-use scale, starting next Monday", which is a
-- different question and the one officers actually keep asking.
--
-- The model does not change: one case row is still exactly one instrument for
-- one family, with its own token, its own response and its own reference id.
-- Assigning three instruments creates three rows. That is deliberate — it keeps
-- every existing guarantee (one response per case, the active-case uniqueness
-- index, the follow-up chain) intact, and it means "a family's caseload" is a
-- query, not a new nullable column on an existing one.
--
-- All this migration adds is WHEN a row becomes answerable.
-- ============================================================================

ALTER TABLE public.family_cases
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

COMMENT ON COLUMN public.family_cases.scheduled_for IS
  'When this assessment becomes answerable. NULL = available immediately (every case created before this migration). family-access refuses to open a case before this instant, so an officer can hand over the slip today for an assessment that starts next month.';

-- Partial: the overwhelming majority of rows are NULL (available now), and the
-- only query that reads this column asks for the ones that are not.
CREATE INDEX IF NOT EXISTS idx_family_cases_scheduled
  ON public.family_cases (scheduled_for)
  WHERE scheduled_for IS NOT NULL;

-- A scheduled date in the far past is a data-entry slip, not a schedule; a date
-- after the case has already expired would mint a credential that can never be
-- used. Guard only the second, which is the one that silently wastes a slip.
DO $$ BEGIN
  ALTER TABLE public.family_cases
    ADD CONSTRAINT family_cases_scheduled_before_expiry
    CHECK (scheduled_for IS NULL OR scheduled_for < expires_at);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
