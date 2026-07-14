-- =========================================================
-- Phase 3: analytics, exports/reports backing functions, and
-- public-submission hardening. Idempotent: safe to re-run.
-- =========================================================

-- =========================================================
-- 1) survey_responses: track completion time + a hashed
--    fingerprint for spam rate-limiting (never the raw IP).
-- =========================================================
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE INDEX IF NOT EXISTS idx_survey_responses_ip_hash ON public.survey_responses(survey_id, ip_hash, submitted_at);

-- =========================================================
-- 2) survey_views — one row per page load of a published
--    survey. Powers the completion-rate metric. Low-risk,
--    low-value target, so a plain anon-insert policy is fine
--    (unlike responses, this doesn't need edge-function
--    rate-limiting).
-- =========================================================
CREATE TABLE IF NOT EXISTS public.survey_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.survey_views TO anon, authenticated;
GRANT SELECT ON public.survey_views TO authenticated;
GRANT ALL ON public.survey_views TO service_role;
ALTER TABLE public.survey_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Views: public insert on published surveys" ON public.survey_views;
CREATE POLICY "Views: public insert on published surveys"
  ON public.survey_views FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published'));

DROP POLICY IF EXISTS "Views: super admin read" ON public.survey_views;
CREATE POLICY "Views: super admin read"
  ON public.survey_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_survey_views_survey ON public.survey_views(survey_id, viewed_at);

-- =========================================================
-- 3) Lock down public submission writes. Anonymous respondents
--    no longer write survey_responses/survey_answers directly —
--    all submissions now go through the rate-limited
--    `submit-response` edge function, which uses the service
--    role. This closes off direct-table-write spam/abuse while
--    keeping the anon SELECT policies (needed to render the
--    survey) untouched.
-- =========================================================
REVOKE INSERT ON public.survey_responses FROM anon;
REVOKE INSERT ON public.survey_answers FROM anon;

DROP POLICY IF EXISTS "Responses: public insert on published surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Answers: public insert tied to own response" ON public.survey_answers;

-- =========================================================
-- 4) Analytics RPCs. All SECURITY INVOKER (the default) so the
--    existing RLS on survey_responses/survey_answers — SELECT
--    restricted to super_admin — still applies to the caller.
--    Only `authenticated` gets EXECUTE; anon cannot call these.
-- =========================================================

CREATE OR REPLACE FUNCTION public.survey_response_stats(p_survey_id uuid)
RETURNS TABLE (
  total_responses bigint,
  responses_today bigint,
  last_response_at timestamptz,
  avg_seconds_to_complete double precision,
  total_views bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    (SELECT count(*) FROM public.survey_responses r WHERE r.survey_id = p_survey_id),
    (SELECT count(*) FROM public.survey_responses r WHERE r.survey_id = p_survey_id AND r.submitted_at::date = now()::date),
    (SELECT max(r.submitted_at) FROM public.survey_responses r WHERE r.survey_id = p_survey_id),
    (SELECT avg(extract(epoch FROM (r.submitted_at - r.started_at)))
       FROM public.survey_responses r
       WHERE r.survey_id = p_survey_id AND r.started_at IS NOT NULL AND r.submitted_at > r.started_at),
    (SELECT count(*) FROM public.survey_views v WHERE v.survey_id = p_survey_id);
$$;
GRANT EXECUTE ON FUNCTION public.survey_response_stats(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.survey_response_stats(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.survey_response_timeseries(p_survey_id uuid, p_granularity text, p_since timestamptz)
RETURNS TABLE (bucket timestamptz, count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT date_trunc(p_granularity, r.submitted_at) AS bucket, count(*) AS count
  FROM public.survey_responses r
  WHERE r.survey_id = p_survey_id AND r.submitted_at >= p_since
  GROUP BY 1
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.survey_response_timeseries(uuid, text, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.survey_response_timeseries(uuid, text, timestamptz) FROM PUBLIC, anon;

-- Value counts for any "countable" question kind (multiple_choice, checkboxes,
-- dropdown, yes_no, likert5, rating5). For checkboxes, value_json is a JSON
-- array of option ids and gets unnested; every other countable kind stores a
-- single value in value_text (option id / 'yes' / 'no') or value_int (1-5).
-- The client maps the raw "value" to a human label (option lookup, or fixed
-- yes/no & scale labels) since that mapping already lives in app code.
CREATE OR REPLACE FUNCTION public.question_value_counts(p_question_id uuid, p_since timestamptz DEFAULT NULL)
RETURNS TABLE (value text, count bigint)
LANGUAGE sql STABLE
AS $$
  WITH scoped AS (
    SELECT a.*
    FROM public.survey_answers a
    JOIN public.survey_responses r ON r.id = a.response_id
    WHERE a.question_id = p_question_id
      AND (p_since IS NULL OR r.submitted_at >= p_since)
  )
  SELECT COALESCE(a.value_text, a.value_int::text, elem.value #>> '{}') AS value, count(*) AS count
  FROM scoped a
  LEFT JOIN LATERAL jsonb_array_elements(a.value_json) AS elem(value) ON a.value_json IS NOT NULL
  WHERE a.value_text IS NOT NULL OR a.value_int IS NOT NULL OR a.value_json IS NOT NULL
  GROUP BY 1
  ORDER BY count DESC;
$$;
GRANT EXECUTE ON FUNCTION public.question_value_counts(uuid, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.question_value_counts(uuid, timestamptz) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.survey_period_comparison(p_survey_id uuid, p_period text)
RETURNS TABLE (current_count bigint, previous_count bigint)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  cur_start timestamptz;
  prev_start timestamptz;
  prev_end timestamptz;
BEGIN
  IF p_period = 'week' THEN
    cur_start := date_trunc('week', now());
    prev_start := cur_start - interval '7 days';
    prev_end := cur_start;
  ELSIF p_period = 'month' THEN
    cur_start := date_trunc('month', now());
    prev_start := cur_start - interval '1 month';
    prev_end := cur_start;
  ELSE
    cur_start := date_trunc('year', now());
    prev_start := cur_start - interval '1 year';
    prev_end := cur_start;
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.survey_responses r WHERE r.survey_id = p_survey_id AND r.submitted_at >= cur_start),
    (SELECT count(*) FROM public.survey_responses r WHERE r.survey_id = p_survey_id AND r.submitted_at >= prev_start AND r.submitted_at < prev_end);
END;
$$;
GRANT EXECUTE ON FUNCTION public.survey_period_comparison(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.survey_period_comparison(uuid, text) FROM PUBLIC, anon;
