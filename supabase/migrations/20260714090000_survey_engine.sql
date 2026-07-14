-- =========================================================
-- Phase 1: Core survey engine
-- Idempotent: safe to re-run. Additive only — the legacy
-- clinical-research tables (participants, assessment_sessions,
-- assessment_responses, question_bank, question_option) are left
-- in place, untouched, and unused by the app going forward.
-- =========================================================

CREATE TYPE public.survey_status AS ENUM ('draft', 'published', 'closed');
CREATE TYPE public.question_kind AS ENUM (
  'multiple_choice', 'checkboxes', 'likert5', 'yes_no', 'rating5', 'short_text', 'long_text', 'dropdown'
);

-- =========================================================
-- surveys
-- =========================================================
CREATE TABLE IF NOT EXISTS public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en text NOT NULL,
  title_te text,
  description_en text,
  description_te text,
  status public.survey_status NOT NULL DEFAULT 'draft',
  slug text UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

GRANT SELECT ON public.surveys TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Surveys: public read published/closed" ON public.surveys;
CREATE POLICY "Surveys: public read published/closed"
  ON public.surveys FOR SELECT TO anon, authenticated
  USING (slug IS NOT NULL);

DROP POLICY IF EXISTS "Surveys: super admin full read" ON public.surveys;
CREATE POLICY "Surveys: super admin full read"
  ON public.surveys FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Surveys: super admin write" ON public.surveys;
CREATE POLICY "Surveys: super admin write"
  ON public.surveys FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Surveys: super admin update" ON public.surveys;
CREATE POLICY "Surveys: super admin update"
  ON public.surveys FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Surveys: super admin delete" ON public.surveys;
CREATE POLICY "Surveys: super admin delete"
  ON public.surveys FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_surveys_updated BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_surveys_slug ON public.surveys(slug);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON public.surveys(status);

-- =========================================================
-- survey_questions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  kind public.question_kind NOT NULL DEFAULT 'short_text',
  prompt_en text NOT NULL,
  prompt_te text,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.survey_questions TO authenticated;
GRANT ALL ON public.survey_questions TO service_role;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Questions: public read of published surveys" ON public.survey_questions;
CREATE POLICY "Questions: public read of published surveys"
  ON public.survey_questions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.slug IS NOT NULL));

DROP POLICY IF EXISTS "Questions: super admin full read" ON public.survey_questions;
CREATE POLICY "Questions: super admin full read"
  ON public.survey_questions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Questions: super admin write" ON public.survey_questions;
CREATE POLICY "Questions: super admin write"
  ON public.survey_questions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Questions: super admin update" ON public.survey_questions;
CREATE POLICY "Questions: super admin update"
  ON public.survey_questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Questions: super admin delete" ON public.survey_questions;
CREATE POLICY "Questions: super admin delete"
  ON public.survey_questions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_survey_questions_updated BEFORE UPDATE ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON public.survey_questions(survey_id, order_index);

-- =========================================================
-- survey_question_options
-- =========================================================
CREATE TABLE IF NOT EXISTS public.survey_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  label_en text NOT NULL,
  label_te text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_question_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.survey_question_options TO authenticated;
GRANT ALL ON public.survey_question_options TO service_role;
ALTER TABLE public.survey_question_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Options: public read of published surveys" ON public.survey_question_options;
CREATE POLICY "Options: public read of published surveys"
  ON public.survey_question_options FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_questions q
      JOIN public.surveys s ON s.id = q.survey_id
      WHERE q.id = question_id AND s.slug IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Options: super admin full read" ON public.survey_question_options;
CREATE POLICY "Options: super admin full read"
  ON public.survey_question_options FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Options: super admin write" ON public.survey_question_options;
CREATE POLICY "Options: super admin write"
  ON public.survey_question_options FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Options: super admin update" ON public.survey_question_options;
CREATE POLICY "Options: super admin update"
  ON public.survey_question_options FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Options: super admin delete" ON public.survey_question_options;
CREATE POLICY "Options: super admin delete"
  ON public.survey_question_options FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_survey_options_question ON public.survey_question_options(question_id, order_index);

-- =========================================================
-- survey_responses (anonymous submission)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  user_agent text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_responses TO authenticated;
GRANT INSERT ON public.survey_responses TO anon, authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Responses: public insert on published surveys" ON public.survey_responses;
CREATE POLICY "Responses: public insert on published surveys"
  ON public.survey_responses FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_id AND s.status = 'published')
  );

DROP POLICY IF EXISTS "Responses: super admin read" ON public.survey_responses;
CREATE POLICY "Responses: super admin read"
  ON public.survey_responses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id, submitted_at);

-- =========================================================
-- survey_answers
-- =========================================================
CREATE TABLE IF NOT EXISTS public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  value_text text,
  value_int int,
  value_json jsonb,
  UNIQUE (response_id, question_id)
);

GRANT SELECT ON public.survey_answers TO authenticated;
GRANT INSERT ON public.survey_answers TO anon, authenticated;
GRANT ALL ON public.survey_answers TO service_role;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Answers: public insert tied to own response" ON public.survey_answers;
CREATE POLICY "Answers: public insert tied to own response"
  ON public.survey_answers FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.survey_responses r
      JOIN public.surveys s ON s.id = r.survey_id
      WHERE r.id = response_id AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Answers: super admin read" ON public.survey_answers;
CREATE POLICY "Answers: super admin read"
  ON public.survey_answers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON public.survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON public.survey_answers(question_id);
