-- ==============================================================
-- Jeevana Insight — PENDING MIGRATIONS
--
-- Four migrations have not been applied to the live database.
-- Until they are, /app/families shows "Something went wrong"
-- because public.family_cases does not exist yet.
--
-- PREFERRED:  supabase link --project-ref wfuxtealkrudukvpmtrg
--             supabase db push
--
-- FALLBACK:   paste this whole file into the Supabase SQL editor.
-- Every statement is idempotent, so re-running is safe.
-- Generated 2026-07-21 14:09 UTC
-- ==============================================================


-- ─────────────────────────────────────────────────────────────
-- 20260718100000_tighten_public_read_rls.sql
-- ─────────────────────────────────────────────────────────────
-- Tighten anonymous public-read RLS.
--
-- The original policies keyed public read on `slug IS NOT NULL`, which is true
-- for both PUBLISHED and CLOSED surveys — so a survey's full question/option
-- content stayed publicly readable even after it was closed and had stopped
-- accepting responses. This restricts the questions and options to surveys that
-- are currently PUBLISHED.
--
-- The survey ROW itself remains readable while published OR closed (never for
-- drafts), so the public runner can still render a calm "this survey is closed"
-- screen — but a closed survey's questions/options are no longer exposed.

DROP POLICY IF EXISTS "Surveys: public read published/closed" ON public.surveys;
CREATE POLICY "Surveys: public read published/closed"
  ON public.surveys FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'closed'));

DROP POLICY IF EXISTS "Questions: public read of published surveys" ON public.survey_questions;
CREATE POLICY "Questions: public read of published surveys"
  ON public.survey_questions FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published')
  );

DROP POLICY IF EXISTS "Options: public read of published surveys" ON public.survey_question_options;
CREATE POLICY "Options: public read of published surveys"
  ON public.survey_question_options FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_questions q
      JOIN public.surveys s ON s.id = q.survey_id
      WHERE q.id = question_id AND s.status = 'published'
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 20260718113000_submission_integrity_and_survey_limits.sql
-- ─────────────────────────────────────────────────────────────
﻿-- Keep public wellbeing surveys short and make the submission rate limit atomic.
CREATE OR REPLACE FUNCTION public.enforce_published_survey_question_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.id;
  IF question_total > 20 THEN
    RAISE EXCEPTION 'Published surveys are limited to 20 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_question_limit_on_question_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.surveys WHERE id = NEW.survey_id AND status = 'published') THEN
    SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.survey_id;
    IF question_total >= 20 THEN
      RAISE EXCEPTION 'Published surveys are limited to 20 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_question_limit_on_question_write ON public.survey_questions;
CREATE TRIGGER trg_enforce_question_limit_on_question_write BEFORE INSERT OR UPDATE OF survey_id ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_question_limit_on_question_write();

DROP TRIGGER IF EXISTS trg_enforce_published_survey_question_limit ON public.surveys;
CREATE TRIGGER trg_enforce_published_survey_question_limit BEFORE INSERT OR UPDATE OF status ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_published_survey_question_limit();

CREATE TABLE IF NOT EXISTS public.survey_submission_rate_limits (
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  last_submitted_at timestamptz NOT NULL DEFAULT now(),
  daily_window_started_at timestamptz NOT NULL DEFAULT now(),
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  PRIMARY KEY (survey_id, ip_hash)
);
ALTER TABLE public.survey_submission_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.survey_submission_rate_limits FROM anon, authenticated;
GRANT ALL ON public.survey_submission_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.claim_survey_submission_slot(
  p_survey_id uuid, p_ip_hash text, p_min_interval_seconds integer DEFAULT 300, p_max_per_day integer DEFAULT 20
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rate_row public.survey_submission_rate_limits; now_at timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_survey_id::text || p_ip_hash, 0));
  SELECT * INTO rate_row FROM public.survey_submission_rate_limits
  WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.survey_submission_rate_limits (survey_id, ip_hash, last_submitted_at, daily_window_started_at, daily_count)
    VALUES (p_survey_id, p_ip_hash, now_at, now_at, 1);
    RETURN true;
  END IF;
  IF rate_row.last_submitted_at > now_at - make_interval(secs => p_min_interval_seconds) THEN RETURN false; END IF;
  IF rate_row.daily_window_started_at <= now_at - interval '24 hours' THEN
    UPDATE public.survey_submission_rate_limits SET last_submitted_at = now_at, daily_window_started_at = now_at, daily_count = 1
    WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash;
    RETURN true;
  END IF;
  IF rate_row.daily_count >= p_max_per_day THEN RETURN false; END IF;
  UPDATE public.survey_submission_rate_limits SET last_submitted_at = now_at, daily_count = daily_count + 1
  WHERE survey_id = p_survey_id AND ip_hash = p_ip_hash;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_survey_submission_slot(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_survey_submission_slot(uuid, text, integer, integer) TO service_role;




-- ─────────────────────────────────────────────────────────────
-- 20260721094500_response_answer_metadata.sql
-- ─────────────────────────────────────────────────────────────
-- Rich response metadata.
--
-- Until now a submission recorded only "which value did they pick". That is
-- enough to score an instrument and nothing else: it cannot distinguish a
-- question deliberately skipped from one never reached, cannot show what the
-- respondent actually saw on screen, and cannot tell a considered answer from
-- one tapped through in two seconds.
--
-- Everything added here is OBSERVED at submit time, never inferred later, so an
-- export is a faithful record of the session rather than a reconstruction.

-- ── survey_answers · what happened on this question ────────────────────────
ALTER TABLE public.survey_answers
  ADD COLUMN IF NOT EXISTS emoji         text,
  ADD COLUMN IF NOT EXISTS seconds_spent integer,
  ADD COLUMN IF NOT EXISTS skipped       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_used    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS answered_at   timestamptz;

-- A skipped row carries no value; every other row must carry one. Without this
-- a bug that dropped the value silently would look like a legitimate skip.
ALTER TABLE public.survey_answers
  DROP CONSTRAINT IF EXISTS survey_answers_skipped_has_no_value;
ALTER TABLE public.survey_answers
  ADD CONSTRAINT survey_answers_skipped_has_no_value
  CHECK (
    NOT skipped
    OR (value_text IS NULL AND value_int IS NULL AND value_json IS NULL)
  );

ALTER TABLE public.survey_answers
  DROP CONSTRAINT IF EXISTS survey_answers_seconds_spent_sane;
ALTER TABLE public.survey_answers
  ADD CONSTRAINT survey_answers_seconds_spent_sane
  CHECK (seconds_spent IS NULL OR (seconds_spent >= 0 AND seconds_spent <= 86400));

-- Emoji is a display glyph, not free text.
ALTER TABLE public.survey_answers
  DROP CONSTRAINT IF EXISTS survey_answers_emoji_short;
ALTER TABLE public.survey_answers
  ADD CONSTRAINT survey_answers_emoji_short
  CHECK (emoji IS NULL OR char_length(emoji) <= 16);

-- Skipped rows are read on their own whenever a report asks "which questions do
-- families leave blank", which is a per-question question, not a per-response one.
CREATE INDEX IF NOT EXISTS idx_survey_answers_skipped
  ON public.survey_answers(question_id)
  WHERE skipped;

-- ── survey_responses · the shape of the session as a whole ─────────────────
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS question_count   integer,
  ADD COLUMN IF NOT EXISTS answered_count   integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS survey_responses_counts_sane;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_counts_sane
  CHECK (
    (question_count IS NULL OR question_count >= 0)
    AND (answered_count IS NULL OR answered_count >= 0)
    AND (question_count IS NULL OR answered_count IS NULL OR answered_count <= question_count)
  );

ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS survey_responses_duration_sane;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_duration_sane
  CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 86400));

-- Completion as a stored fact of the submission rather than a join at read
-- time. Generated, so it can never drift from the two counts it derives from.
-- NULL for rows submitted before this migration — genuinely unknown, and an
-- honest NULL beats a fabricated 100%.
ALTER TABLE public.survey_responses
  DROP COLUMN IF EXISTS completion_pct;
ALTER TABLE public.survey_responses
  ADD COLUMN completion_pct numeric(5, 2)
  GENERATED ALWAYS AS (
    CASE
      WHEN question_count IS NULL OR answered_count IS NULL OR question_count = 0 THEN NULL
      ELSE round((answered_count::numeric * 100) / question_count, 2)
    END
  ) STORED;

COMMENT ON COLUMN public.survey_answers.emoji IS
  'The glyph shown beside the chosen option on the respondent''s screen, captured at choice time.';
COMMENT ON COLUMN public.survey_answers.skipped IS
  'Moved past with the Skip control. Distinct from a question that was simply never reached (no row at all).';
COMMENT ON COLUMN public.survey_answers.edited IS
  'The answer was changed after one had already been given.';
COMMENT ON COLUMN public.survey_responses.completion_pct IS
  'Generated from answered_count / question_count. NULL for pre-migration rows.';


-- ─────────────────────────────────────────────────────────────
-- 20260721101500_family_case_workflow.sql
-- ─────────────────────────────────────────────────────────────
-- =========================================================
-- Family Case Workflow
--
-- Turns the platform from "publish a link, hope someone answers" into a
-- controlled research instrument: a field officer creates a CASE for one
-- bereaved family, the system mints that family's own credentials, and the
-- family answers exactly one assigned assessment — nothing else.
--
-- Security model, stated once because everything below follows from it:
--
--   A respondent is NEVER a database principal. They hold no Supabase JWT,
--   no anon key privilege over these tables, and no row-level grant. Every
--   read and write they cause travels through the `family-access` edge
--   function running as service_role, which resolves their opaque session
--   token to exactly one family_cases row and refuses to look anywhere else.
--   That is why there is not a single `TO anon` grant in this file.
--
-- Ordered AFTER 20260721094500_response_answer_metadata.sql on purpose:
-- family_case_stats() reads survey_responses.duration_seconds, which that
-- migration introduces. A `LANGUAGE sql` body is validated at CREATE time, so
-- running this first would fail on an unknown column.
--
-- Idempotent: safe to re-run.
-- =========================================================

-- ---------------------------------------------------------
-- Status
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'family_case_status') THEN
    CREATE TYPE public.family_case_status AS ENUM (
      'not_started',  -- created, never opened
      'opened',       -- the link/QR was resolved, or a login succeeded
      'in_progress',  -- at least one answer has been saved
      'completed',    -- submitted
      'expired',      -- past expires_at without a submission
      'reopened'      -- an administrator deliberately reopened a completed case
    );
  END IF;
END $$;

-- ---------------------------------------------------------
-- Human-readable reference id
--
-- Officers read these aloud over a phone line and write them on paper case
-- files, so it is a short, year-scoped, zero-padded counter rather than a
-- uuid fragment. The sequence is global (not per-year) so a reference is
-- never reissued even if the year rolls over mid-transaction.
-- ---------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.family_case_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.next_family_reference_id()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JIF-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.family_case_ref_seq')::text, 5, '0');
$$;

-- ---------------------------------------------------------
-- family_cases
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text NOT NULL UNIQUE DEFAULT public.next_family_reference_id(),

  -- What the officer collected in the field.
  deceased_name text NOT NULL,
  family_head_name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  district text NOT NULL,
  village text,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'te')),
  notes text,

  -- The one instrument this family may answer. RESTRICT, not CASCADE: deleting
  -- a survey out from under live field cases would silently strand families
  -- holding a printed slip.
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE RESTRICT,

  -- Credentials. `pin` is stored readable ON PURPOSE, and only super admins can
  -- SELECT it (see RLS below). A field officer has to be able to re-read a lost
  -- PIN over the phone or reprint a slip; a write-only hash would mean
  -- regenerating and re-contacting a grieving family every time paper goes
  -- missing. It is a temporary, single-case, revocable 6-digit code — not a
  -- password — and it is defended by the lockout counters below, by the fact
  -- that it is useless without also knowing the phone number, and by an audit
  -- trail on every view. Rotate it with the Regenerate action.
  access_token text NOT NULL UNIQUE,
  pin text NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
  pin_issued_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,

  status public.family_case_status NOT NULL DEFAULT 'not_started',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  opened_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  -- Server-side draft. localStorage alone loses everything the moment a family
  -- switches from the officer's tablet to their own phone, which is exactly how
  -- these assessments get finished.
  draft jsonb,
  draft_updated_at timestamptz,

  response_id uuid REFERENCES public.survey_responses(id) ON DELETE SET NULL,

  officer_id uuid REFERENCES auth.users(id),
  officer_name text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Login is (phone, pin) with no case id, so that pair must resolve to exactly
-- one row or the lookup is ambiguous. The generator retries on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_cases_phone_pin ON public.family_cases(phone, pin);
CREATE INDEX IF NOT EXISTS idx_family_cases_status ON public.family_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_cases_survey ON public.family_cases(survey_id);
CREATE INDEX IF NOT EXISTS idx_family_cases_phone ON public.family_cases(phone);
CREATE INDEX IF NOT EXISTS idx_family_cases_district ON public.family_cases(district);
CREATE INDEX IF NOT EXISTS idx_family_cases_officer ON public.family_cases(officer_id);

ALTER TABLE public.family_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_cases FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_cases TO authenticated;
GRANT ALL ON public.family_cases TO service_role;

DROP POLICY IF EXISTS "Family cases: super admin read" ON public.family_cases;
CREATE POLICY "Family cases: super admin read"
  ON public.family_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Family cases: super admin insert" ON public.family_cases;
CREATE POLICY "Family cases: super admin insert"
  ON public.family_cases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Family cases: super admin update" ON public.family_cases;
CREATE POLICY "Family cases: super admin update"
  ON public.family_cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Family cases: super admin delete" ON public.family_cases;
CREATE POLICY "Family cases: super admin delete"
  ON public.family_cases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_family_cases_updated ON public.family_cases;
CREATE TRIGGER trg_family_cases_updated BEFORE UPDATE ON public.family_cases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------
-- family_case_sessions
--
-- Only the SHA-256 of a session token is stored: a leaked database dump must
-- not hand anyone a working respondent session.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_case_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.family_cases(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent text,
  ip_hash text
);

CREATE INDEX IF NOT EXISTS idx_family_sessions_case ON public.family_case_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_family_sessions_expiry ON public.family_case_sessions(expires_at);

ALTER TABLE public.family_case_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_case_sessions FROM anon, authenticated;
GRANT ALL ON public.family_case_sessions TO service_role;
-- No policy for `authenticated` on purpose: session rows are the edge
-- function's business alone. Even an administrator has no reason to read them,
-- and being unable to is what makes a stolen session unforgeable from inside.

-- ---------------------------------------------------------
-- family_case_events — the case timeline
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.family_cases(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_events_case ON public.family_case_events(case_id, created_at DESC);

ALTER TABLE public.family_case_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_case_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.family_case_events TO authenticated;
GRANT ALL ON public.family_case_events TO service_role;

DROP POLICY IF EXISTS "Family events: super admin read" ON public.family_case_events;
CREATE POLICY "Family events: super admin read"
  ON public.family_case_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Family events: super admin insert" ON public.family_case_events;
CREATE POLICY "Family events: super admin insert"
  ON public.family_case_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------
-- Response provenance
--
-- A research row has to carry provenance. Without these a completed assessment
-- is an anonymous blob that cannot be traced to the family, officer or district
-- it came from — which is the entire point of a controlled study.
--
-- PER-ANSWER METADATA IS NOT DEFINED HERE. The emoji / seconds_spent / skipped
-- / edited / voice_used columns and the response-level question_count,
-- answered_count, duration_seconds and generated completion_pct all belong to
-- 20260721094500_response_answer_metadata.sql, which owns that concern for both
-- the public and the credentialled flow. Duplicating them here produced two
-- columns for one fact (`seconds` vs `seconds_spent`) and a plain
-- completion_pct that the later migration then dropped and replaced with a
-- GENERATED one — which would have made every INSERT from the family-access
-- function fail. This migration adds only the two columns that are genuinely
-- about family cases.
-- ---------------------------------------------------------
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS family_case_id uuid REFERENCES public.family_cases(id) ON DELETE SET NULL;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS reference_id text;

CREATE INDEX IF NOT EXISTS idx_survey_responses_case ON public.survey_responses(family_case_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_reference ON public.survey_responses(reference_id);

-- ---------------------------------------------------------
-- Instrument length
--
-- The 20-question ceiling was written for short anonymous well-being polls
-- handed out by public link. A credentialled family case is the opposite
-- situation: a validated 128-item battery answered once, in private, by a
-- family that was visited in person. The cap moves to a number that only
-- catches runaway imports.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_published_survey_question_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.id;
  IF question_total > 300 THEN
    RAISE EXCEPTION 'A survey is limited to 300 questions; split this instrument into reviewed modules.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_question_limit_on_question_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE question_total integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.surveys WHERE id = NEW.survey_id AND status = 'published') THEN
    SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.survey_id;
    IF question_total >= 300 THEN
      RAISE EXCEPTION 'A survey is limited to 300 questions; split this instrument into reviewed modules.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- Expiry sweep
--
-- Status is stored rather than derived so the list can be indexed and filtered
-- cheaply; this keeps the stored value honest. Called by the edge function on
-- every admin list load, which is often enough for a field workflow and avoids
-- depending on pg_cron being enabled.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_family_cases()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  WITH swept AS (
    UPDATE public.family_cases
       SET status = 'expired'
     WHERE expires_at < now()
       AND status IN ('not_started', 'opened', 'in_progress', 'reopened')
    RETURNING id
  )
  INSERT INTO public.family_case_events (case_id, event, actor)
  SELECT id, 'expired', 'system' FROM swept;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_family_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_family_cases() TO authenticated, service_role;

-- ---------------------------------------------------------
-- Login throttle
--
-- The per-case lockout below stops someone hammering ONE known family. It does
-- nothing against blind enumeration, where every guess is a different (phone,
-- pin) pair and so a different case. This throttles the connection instead, so
-- sweeping the 10^6 PIN space is not a thing you can do from a laptop.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_login_attempts (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.family_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_login_attempts FROM anon, authenticated;
GRANT ALL ON public.family_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.claim_family_login_attempt(
  p_ip_hash text, p_window_seconds integer DEFAULT 900, p_max_attempts integer DEFAULT 30
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_state public.family_login_attempts; now_at timestamptz := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  SELECT * INTO row_state FROM public.family_login_attempts WHERE ip_hash = p_ip_hash FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.family_login_attempts (ip_hash, window_started_at, attempts, last_attempt_at)
    VALUES (p_ip_hash, now_at, 1, now_at);
    RETURN true;
  END IF;

  IF row_state.window_started_at <= now_at - make_interval(secs => p_window_seconds) THEN
    UPDATE public.family_login_attempts
       SET window_started_at = now_at, attempts = 1, last_attempt_at = now_at
     WHERE ip_hash = p_ip_hash;
    RETURN true;
  END IF;

  IF row_state.attempts >= p_max_attempts THEN RETURN false; END IF;

  UPDATE public.family_login_attempts
     SET attempts = attempts + 1, last_attempt_at = now_at
   WHERE ip_hash = p_ip_hash;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_family_login_attempt(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_family_login_attempt(text, integer, integer) TO service_role;

-- ---------------------------------------------------------
-- Case statistics for the dashboard, in one round trip.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.family_case_stats()
RETURNS TABLE (
  total bigint,
  not_started bigint,
  opened bigint,
  in_progress bigint,
  completed bigint,
  expired bigint,
  completed_today bigint,
  avg_completion_seconds numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'not_started'),
    count(*) FILTER (WHERE status IN ('opened', 'reopened')),
    count(*) FILTER (WHERE status = 'in_progress'),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'expired'),
    count(*) FILTER (WHERE status = 'completed' AND completed_at::date = now()::date),
    (SELECT avg(r.duration_seconds) FROM public.survey_responses r WHERE r.family_case_id IS NOT NULL AND r.duration_seconds IS NOT NULL)
  FROM public.family_cases;
$$;

REVOKE ALL ON FUNCTION public.family_case_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_case_stats() TO authenticated, service_role;

