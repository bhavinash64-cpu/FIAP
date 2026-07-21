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
