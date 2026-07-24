-- =========================================================
-- Longitudinal follow-ups
--
-- Bereavement research measures CHANGE. A single reading three weeks after a
-- death says almost nothing on its own; the finding lives in the difference
-- between baseline, three months and six months. So the platform has to be able
-- to re-administer the same instrument to the same family on a schedule.
--
-- Why each round is its OWN family_cases row rather than a repeated submission
-- against one case — this is the whole design, and everything below follows
-- from it:
--
--   A timepoint needs its own response, its own completion timestamp and its
--   own credentials. If round two wrote back into round one's case, the
--   completed_at, the draft, the response_id and the status would all be
--   overwritten, and the earlier reading — the thing the later reading is being
--   compared against — would be destroyed. You would be left with one row that
--   only ever describes "most recent", which is precisely the quantity a
--   longitudinal design is not interested in.
--
--   Separate rows also mean separate access tokens, so a family can be sent a
--   fresh slip for round two without reviving the link from round one, and a
--   round can be expired, reopened or deleted without disturbing its siblings.
--
-- The rounds are linked by followup_parent_id, forming a chain from the
-- baseline case (parent NULL) forward. The chain, not the row, is the family's
-- record.
--
-- Idempotent: safe to re-run.
-- =========================================================

-- The token generator below needs pgcrypto. On Supabase it is already present
-- in the `extensions` schema; the guard is for a plain Postgres that has not
-- had it installed. CREATE EXTENSION IF NOT EXISTS would relocate nothing but
-- still errors on some managed roles, so the existence check comes first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

-- ---------------------------------------------------------
-- Schedule columns
-- ---------------------------------------------------------
ALTER TABLE public.family_cases ADD COLUMN IF NOT EXISTS followup_interval_days integer;
ALTER TABLE public.family_cases ADD COLUMN IF NOT EXISTS followup_rounds_total integer NOT NULL DEFAULT 1;
ALTER TABLE public.family_cases ADD COLUMN IF NOT EXISTS followup_round integer NOT NULL DEFAULT 1;
ALTER TABLE public.family_cases ADD COLUMN IF NOT EXISTS followup_parent_id uuid REFERENCES public.family_cases(id) ON DELETE SET NULL;
ALTER TABLE public.family_cases ADD COLUMN IF NOT EXISTS followup_due_at timestamptz;

COMMENT ON COLUMN public.family_cases.followup_interval_days IS
  'Days between rounds. NULL means this is a one-off case with no schedule.';
COMMENT ON COLUMN public.family_cases.followup_rounds_total IS
  'How many rounds the study plans in total, baseline included. 1 = no follow-up.';
COMMENT ON COLUMN public.family_cases.followup_round IS
  'Which timepoint this row is. Baseline is 1.';
COMMENT ON COLUMN public.family_cases.followup_parent_id IS
  'The previous round. NULL on the baseline case. ON DELETE SET NULL so deleting one round orphans rather than cascades the rest of the series.';
COMMENT ON COLUMN public.family_cases.followup_due_at IS
  'When the NEXT round becomes due. Read by create_due_family_followups().';

-- rounds_total below 1 would make every case instantly "finished"; a zero or
-- negative interval would schedule the next round in the past forever.
ALTER TABLE public.family_cases DROP CONSTRAINT IF EXISTS family_cases_followup_rounds_check;
ALTER TABLE public.family_cases
  ADD CONSTRAINT family_cases_followup_rounds_check
  CHECK (followup_rounds_total >= 1 AND followup_round >= 1);

ALTER TABLE public.family_cases DROP CONSTRAINT IF EXISTS family_cases_followup_interval_check;
ALTER TABLE public.family_cases
  ADD CONSTRAINT family_cases_followup_interval_check
  CHECK (followup_interval_days IS NULL OR followup_interval_days > 0);

-- The sweep below scans for due rounds only among scheduled cases, so the index
-- is partial: on a caseload that is mostly one-off cases this stays tiny.
DROP INDEX IF EXISTS public.idx_family_cases_followup_due;
CREATE INDEX IF NOT EXISTS idx_family_cases_followup_due
  ON public.family_cases (followup_due_at)
  WHERE followup_interval_days IS NOT NULL;

-- Both the "does this parent already have a child" test and the client's chain
-- walk look a case up by its parent. Without this they are sequential scans of
-- the whole caseload, once per candidate.
CREATE INDEX IF NOT EXISTS idx_family_cases_followup_parent
  ON public.family_cases (followup_parent_id)
  WHERE followup_parent_id IS NOT NULL;

-- ---------------------------------------------------------
-- create_due_family_followups()
--
-- Mints the next round for every family whose previous round is finished and
-- whose interval has elapsed. Called from the caseload page rather than from
-- pg_cron, for the same reason as the expiry sweep: the field workflow is
-- bursty and an admin opening the module is a good enough clock, and it avoids
-- depending on an extension being enabled.
--
-- SECURITY DEFINER because it writes across a table whose RLS admits only super
-- admins, and it MUTATES — so it must authorise itself. Inside a definer
-- function there is no RLS left to do it. Same guard as the other family RPCs.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_due_family_followups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions` is on the path because gen_random_bytes() lives there on
-- Supabase; on a plain Postgres pgcrypto lands in public and this still resolves.
SET search_path = public, extensions
AS $$
DECLARE created integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = 'insufficient_privilege';
  END IF;

  WITH due AS (
    -- DISTINCT ON (phone, survey_id) is load-bearing, not tidiness. The
    -- anti-join below only sees rows that were already live when the statement
    -- started; it cannot see the children this same statement is about to
    -- insert. Two completed chains for one household on one instrument — which
    -- the partial unique index permits, because neither parent is live — would
    -- therefore both qualify, both mint a 'not_started' child, and collide on
    -- uq_family_cases_active_phone_survey. That aborts the WHOLE batch, and
    -- every later sweep too, wedging the feature permanently. Taking the
    -- oldest-due parent only defers the other family to the next sweep, which
    -- is the behaviour the anti-join was already aiming for.
    SELECT DISTINCT ON (p.phone, p.survey_id) p.*
      FROM public.family_cases p
     WHERE p.status = 'completed'
       AND p.followup_interval_days IS NOT NULL
       AND p.followup_round < p.followup_rounds_total
       AND p.followup_due_at IS NOT NULL
       AND p.followup_due_at <= now()
       -- One child per parent, ever. This is what makes the sweep idempotent:
       -- calling it twice in a minute cannot mint two round-twos.
       AND NOT EXISTS (
         SELECT 1 FROM public.family_cases c WHERE c.followup_parent_id = p.id
       )
       -- uq_family_cases_active_phone_survey is a PARTIAL unique index over
       -- (phone, survey_id) restricted to the four live statuses. It looks like
       -- it forbids what we are about to do — it does not: the parent is
       -- 'completed', which is outside the index predicate, so parent and child
       -- never collide. What it WOULD collide with is an unrelated live case an
       -- officer opened by hand for the same family and instrument. Excluding
       -- those here turns a unique violation that would abort the entire batch
       -- into one family quietly waiting for the next sweep.
       AND NOT EXISTS (
         SELECT 1 FROM public.family_cases a
          WHERE a.phone = p.phone
            AND a.survey_id = p.survey_id
            AND a.status IN ('not_started', 'opened', 'in_progress', 'reopened')
       )
     -- The id tiebreak makes the choice deterministic, so a sweep that is
     -- retried picks the same parent rather than alternating between two.
     ORDER BY p.phone, p.survey_id, p.followup_due_at, p.id
  ),
  inserted AS (
    INSERT INTO public.family_cases (
      deceased_name, family_head_name, relationship, phone, district, village,
      preferred_language, notes, survey_id, officer_id, officer_name,
      access_token, status, expires_at,
      followup_interval_days, followup_rounds_total, followup_round,
      followup_parent_id, followup_due_at
    )
    SELECT
      d.deceased_name, d.family_head_name, d.relationship, d.phone, d.district, d.village,
      d.preferred_language, d.notes, d.survey_id, d.officer_id, d.officer_name,
      -- 32 hex characters, i.e. 128 bits. This is deliberately NOT the client's
      -- nanoid alphabet (22 chars of an unambiguous 31-symbol set, ~109 bits):
      -- nothing in the database can call that generator, and a token minted here
      -- is never read aloud, only scanned or clicked. It is at least as
      -- unguessable, and uniqueness is enforced either way by the existing
      -- UNIQUE constraint on access_token.
      encode(gen_random_bytes(16), 'hex'),
      'not_started'::public.family_case_status,
      now() + interval '90 days',
      d.followup_interval_days,
      d.followup_rounds_total,
      d.followup_round + 1,
      d.id,
      -- The clock for the round AFTER this one starts now, not at the parent's
      -- due date: a family that answers late should get their next window
      -- measured from the real interval, not from a schedule they never met.
      now() + make_interval(days => d.followup_interval_days)
    FROM due d
    -- reference_id comes from its own DEFAULT so the new round gets a fresh
    -- PDH- number an officer can read out, not a suffix of the parent's.
    RETURNING id, followup_parent_id, followup_round
  )
  INSERT INTO public.family_case_events (case_id, event, detail, actor)
  SELECT
    i.id,
    'followup_created',
    jsonb_build_object('parent_case_id', i.followup_parent_id, 'round', i.followup_round),
    'system'
  FROM inserted i;

  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END;
$$;

-- Same posture as the other family RPCs: anon never gets a caseload mutation,
-- and stating it explicitly stops a future blanket GRANT from handing one over.
REVOKE ALL ON FUNCTION public.create_due_family_followups() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_due_family_followups() TO authenticated, service_role;
