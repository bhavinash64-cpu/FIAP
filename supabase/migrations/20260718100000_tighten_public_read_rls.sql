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
