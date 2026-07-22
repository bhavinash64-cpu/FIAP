-- =========================================================
-- Count surveys' questions and responses in the database, not the browser.
--
-- listSurveys() built its two counts by SELECTing every row of
-- survey_questions and every row of survey_responses and tallying them in
-- JavaScript. That is O(all questions + all responses) network and memory for
-- a screen that displays two integers per survey. With eight modules it is
-- ~290 rows and invisible; at a few thousand households it is megabytes of
-- response ids shipped to an admin laptop on every visit to /app/surveys, and
-- it degrades exactly as the study succeeds.
--
-- SECURITY INVOKER, deliberately: the counts must be computed under the
-- caller's own RLS, so this can never become a way to learn how many responses
-- exist on a survey the caller cannot see. Consequently the aggregate obeys
-- the same policies the old client-side tally did, and returns the same
-- numbers.
-- =========================================================
CREATE OR REPLACE FUNCTION public.survey_list_counts()
RETURNS TABLE (survey_id uuid, question_count bigint, response_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id,
         (SELECT count(*) FROM public.survey_questions q WHERE q.survey_id = s.id),
         (SELECT count(*) FROM public.survey_responses r WHERE r.survey_id = s.id)
  FROM public.surveys s
$$;

REVOKE ALL ON FUNCTION public.survey_list_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.survey_list_counts() TO authenticated;
