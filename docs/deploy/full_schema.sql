-- ============================================================================
-- PsyDigiHealth — COMPLETE database schema, all migrations in order.
-- Generated for a FRESH Supabase project. Paste this whole file into the
-- Supabase SQL Editor and Run. Every statement is idempotent, so re-running
-- is safe. This is the exact equivalent of `supabase db push` on an empty DB.
-- ============================================================================


-- ####################################################################
-- 20260705052505_3420167a-0b65-49f9-9240-1c750668abb0.sql
-- ####################################################################

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'police', 'researcher', 'analyst');
CREATE TYPE public.study_group AS ENUM ('case', 'control');
CREATE TYPE public.instrument_type AS ENUM ('DEMOGRAPHIC', 'PID5BF', 'IRI', 'CIUS', 'DIGITAL_USE', 'SUICIDE_HISTORY');
CREATE TYPE public.session_status AS ENUM ('in_progress', 'completed', 'abandoned');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  district TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)) $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto create profile + default researcher role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  -- Default new users to researcher; admin can upgrade
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'researcher');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Participants
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  study_group public.study_group NOT NULL,
  age_band TEXT NOT NULL,  -- 'A_18_24' or 'B_25_39'
  age INT,
  gender TEXT,
  district TEXT,
  mandal TEXT,
  hospital TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at TIMESTAMPTZ,
  consent_language TEXT DEFAULT 'en',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view participants" ON public.participants FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher','analyst']::public.app_role[]));
CREATE POLICY "Fieldstaff create participants" ON public.participants FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Fieldstaff update participants" ON public.participants FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Admin delete participants" ON public.participants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Assessment sessions
CREATE TABLE public.assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  instrument public.instrument_type NOT NULL,
  status public.session_status NOT NULL DEFAULT 'in_progress',
  current_index INT NOT NULL DEFAULT 0,
  total_items INT NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  score JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_id, instrument)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_sessions TO authenticated;
GRANT ALL ON public.assessment_sessions TO service_role;
ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view sessions" ON public.assessment_sessions FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher','analyst']::public.app_role[]));
CREATE POLICY "Fieldstaff write sessions" ON public.assessment_sessions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Fieldstaff update sessions" ON public.assessment_sessions FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Admin delete sessions" ON public.assessment_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Assessment responses
CREATE TABLE public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  value_int INT,
  value_text TEXT,
  value_json JSONB,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, question_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO authenticated;
GRANT ALL ON public.assessment_responses TO service_role;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view responses" ON public.assessment_responses FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher','analyst']::public.app_role[]));
CREATE POLICY "Fieldstaff write responses" ON public.assessment_responses FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Fieldstaff update responses" ON public.assessment_responses FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','police','researcher']::public.app_role[]));
CREATE POLICY "Admin delete responses" ON public.assessment_responses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','analyst']::public.app_role[]));
CREATE POLICY "Anyone insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_participants_updated BEFORE UPDATE ON public.participants FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.assessment_sessions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_participants_district ON public.participants(district);
CREATE INDEX idx_participants_group ON public.participants(study_group);
CREATE INDEX idx_sessions_participant ON public.assessment_sessions(participant_id);
CREATE INDEX idx_responses_session ON public.assessment_responses(session_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);


-- ####################################################################
-- 20260705052520_d956c7b4-7be0-40a3-b67e-6e735a3b9167.sql
-- ####################################################################

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_any_role(public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(public.app_role[]) TO authenticated;


-- ####################################################################
-- 20260714071602_257c5506-5877-4ff3-94e7-4665aa64a2d6.sql
-- ####################################################################

-- Add new role values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';


-- ####################################################################
-- 20260714071701_e2dbb669-5d4a-4ea7-883f-ee37e312016b.sql
-- ####################################################################

-- =========================================================
-- 1) Backfill roles → super_admin, and update signup trigger
-- =========================================================
UPDATE public.user_roles SET role = 'super_admin' WHERE role IN ('admin','police','researcher','analyst');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 2) Participants: add owner_user_id for self-onboarding
-- =========================================================
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS participants_owner_user_id_idx ON public.participants(owner_user_id);

-- Allow existing NOT NULL columns to be optional for self-serve users
ALTER TABLE public.participants ALTER COLUMN age_band DROP NOT NULL;
ALTER TABLE public.participants ALTER COLUMN study_group DROP NOT NULL;

-- =========================================================
-- 3) Rewrite RLS policies around (user | super_admin)
-- =========================================================

-- Participants
DROP POLICY IF EXISTS "Admin delete participants" ON public.participants;
DROP POLICY IF EXISTS "Fieldstaff create participants" ON public.participants;
DROP POLICY IF EXISTS "Fieldstaff update participants" ON public.participants;
DROP POLICY IF EXISTS "Staff view participants" ON public.participants;

CREATE POLICY "Users view own participant"
  ON public.participants FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users insert own participant"
  ON public.participants FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users update own participant"
  ON public.participants FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin delete participants"
  ON public.participants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Assessment sessions
DROP POLICY IF EXISTS "Admin delete sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Fieldstaff update sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Fieldstaff write sessions" ON public.assessment_sessions;
DROP POLICY IF EXISTS "Staff view sessions" ON public.assessment_sessions;

CREATE POLICY "Users view own sessions"
  ON public.assessment_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.participants p WHERE p.id = participant_id AND p.owner_user_id = auth.uid())
  );

CREATE POLICY "Users insert own sessions"
  ON public.assessment_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.participants p WHERE p.id = participant_id AND p.owner_user_id = auth.uid())
  );

CREATE POLICY "Users update own sessions"
  ON public.assessment_sessions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.participants p WHERE p.id = participant_id AND p.owner_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.participants p WHERE p.id = participant_id AND p.owner_user_id = auth.uid())
  );

CREATE POLICY "Super admin delete sessions"
  ON public.assessment_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Assessment responses
DROP POLICY IF EXISTS "Admin delete responses" ON public.assessment_responses;
DROP POLICY IF EXISTS "Fieldstaff update responses" ON public.assessment_responses;
DROP POLICY IF EXISTS "Fieldstaff write responses" ON public.assessment_responses;
DROP POLICY IF EXISTS "Staff view responses" ON public.assessment_responses;

CREATE POLICY "Users view own responses"
  ON public.assessment_responses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      JOIN public.participants p ON p.id = s.participant_id
      WHERE s.id = session_id AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own responses"
  ON public.assessment_responses FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      JOIN public.participants p ON p.id = s.participant_id
      WHERE s.id = session_id AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own responses"
  ON public.assessment_responses FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      JOIN public.participants p ON p.id = s.participant_id
      WHERE s.id = session_id AND p.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.assessment_sessions s
      JOIN public.participants p ON p.id = s.participant_id
      WHERE s.id = session_id AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin delete responses"
  ON public.assessment_responses FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Audit logs
DROP POLICY IF EXISTS "Anyone insert audit" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff view audit" ON public.audit_logs;
CREATE POLICY "Any authenticated insert audit"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super admin view audit"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Super admin manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Profiles: super admin should see all; keep own read/write
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles: own or super admin readable"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- =========================================================
-- 4) Question bank
-- =========================================================
CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  key text NOT NULL,
  kind text NOT NULL DEFAULT 'likert',
  prompt_en text NOT NULL,
  prompt_te text,
  hint_en text,
  hint_te text,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  domain text,
  reverse boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument, key)
);

GRANT SELECT ON public.question_bank TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "QB read authenticated"
  ON public.question_bank FOR SELECT TO authenticated USING (true);
CREATE POLICY "QB super admin write"
  ON public.question_bank FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "QB super admin update"
  ON public.question_bank FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "QB super admin delete"
  ON public.question_bank FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_qb_updated_at BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.question_option (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  value_int int,
  value_text text,
  label_en text NOT NULL,
  label_te text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS question_option_question_id_idx ON public.question_option(question_id);

GRANT SELECT ON public.question_option TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.question_option TO authenticated;
GRANT ALL ON public.question_option TO service_role;
ALTER TABLE public.question_option ENABLE ROW LEVEL SECURITY;

CREATE POLICY "QO read authenticated"
  ON public.question_option FOR SELECT TO authenticated USING (true);
CREATE POLICY "QO super admin write"
  ON public.question_option FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "QO super admin update"
  ON public.question_option FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "QO super admin delete"
  ON public.question_option FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));


-- ####################################################################
-- 20260714090000_survey_engine.sql
-- ####################################################################
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


-- ####################################################################
-- 20260714120000_ai_question_creation.sql
-- ####################################################################
-- =========================================================
-- Phase 2: AI question creation (PDF extraction + voice)
-- Idempotent: safe to re-run. Additive only.
-- =========================================================

CREATE TYPE public.question_origin AS ENUM ('manual', 'voice', 'pdf');

ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS origin public.question_origin NOT NULL DEFAULT 'manual';

ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS source_ref uuid;

-- =========================================================
-- import_batches — one row per PDF/voice import, so an admin
-- can see provenance and undo a whole import in one action.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  source_type public.question_origin NOT NULL,
  file_name text,
  question_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Import batches: super admin all" ON public.import_batches;
CREATE POLICY "Import batches: super admin all"
  ON public.import_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_import_batches_survey ON public.import_batches(survey_id);

-- Let survey_questions.source_ref point at an import batch (added after
-- the table exists so both directions are declarable).
DO $$ BEGIN
  ALTER TABLE public.survey_questions
    ADD CONSTRAINT survey_questions_source_ref_fkey
    FOREIGN KEY (source_ref) REFERENCES public.import_batches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================
-- Private storage bucket for uploaded source PDFs (audit trail only —
-- extraction itself works off client-parsed text, not this bucket).
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('survey-imports', 'survey-imports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Survey imports: super admin read" ON storage.objects;
CREATE POLICY "Survey imports: super admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'survey-imports' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Survey imports: super admin write" ON storage.objects;
CREATE POLICY "Survey imports: super admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'survey-imports' AND public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Survey imports: super admin delete" ON storage.objects;
CREATE POLICY "Survey imports: super admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'survey-imports' AND public.has_role(auth.uid(), 'super_admin'));


-- ####################################################################
-- 20260714150000_analytics_and_hardening.sql
-- ####################################################################
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


-- ####################################################################
-- 20260717070925_survey_sections_and_batch_reorder.sql
-- ####################################################################
-- =========================================================
-- Question Builder: sections + batch reorder
-- Additive only. Existing questions keep section_id NULL and
-- render in the default "Ungrouped" band, so nothing breaks.
-- =========================================================

-- ---------------------------------------------------------
-- survey_sections
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  title_en text NOT NULL DEFAULT 'Untitled section',
  title_te text,
  description_en text,
  description_te text,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.survey_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.survey_sections TO authenticated;
GRANT ALL ON public.survey_sections TO service_role;
ALTER TABLE public.survey_sections ENABLE ROW LEVEL SECURITY;

-- Public read mirrors surveys: a section is readable when its survey is shared.
DROP POLICY IF EXISTS "Sections: public read shared" ON public.survey_sections;
CREATE POLICY "Sections: public read shared"
  ON public.survey_sections FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_sections.survey_id AND s.slug IS NOT NULL
  ));

DROP POLICY IF EXISTS "Sections: super admin read" ON public.survey_sections;
CREATE POLICY "Sections: super admin read"
  ON public.survey_sections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Sections: super admin insert" ON public.survey_sections;
CREATE POLICY "Sections: super admin insert"
  ON public.survey_sections FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Sections: super admin update" ON public.survey_sections;
CREATE POLICY "Sections: super admin update"
  ON public.survey_sections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Sections: super admin delete" ON public.survey_sections;
CREATE POLICY "Sections: super admin delete"
  ON public.survey_sections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_survey_sections_updated ON public.survey_sections;
CREATE TRIGGER trg_survey_sections_updated BEFORE UPDATE ON public.survey_sections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_survey_sections_survey ON public.survey_sections(survey_id, order_index);

-- ---------------------------------------------------------
-- survey_questions.section_id  (nullable = ungrouped)
-- ON DELETE SET NULL: deleting a section releases its questions
-- back to Ungrouped rather than destroying respondent-facing data.
-- ---------------------------------------------------------
ALTER TABLE public.survey_questions
  ADD COLUMN IF NOT EXISTS section_id uuid
  REFERENCES public.survey_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_survey_questions_section ON public.survey_questions(section_id);

-- ---------------------------------------------------------
-- Batch reorder: one round trip instead of one UPDATE per row.
-- Accepts [{"id":uuid,"order_index":int,"section_id":uuid|null}, ...]
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_survey_questions(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.survey_questions q
  SET order_index = v.order_index,
      section_id  = v.section_id
  FROM (
    SELECT (e->>'id')::uuid          AS id,
           (e->>'order_index')::int  AS order_index,
           NULLIF(e->>'section_id','')::uuid AS section_id
    FROM jsonb_array_elements(items) AS e
  ) v
  WHERE q.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_survey_questions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_survey_questions(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_survey_sections(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.survey_sections s
  SET order_index = v.order_index
  FROM (
    SELECT (e->>'id')::uuid         AS id,
           (e->>'order_index')::int AS order_index
    FROM jsonb_array_elements(items) AS e
  ) v
  WHERE s.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_survey_sections(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_survey_sections(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.reorder_survey_options(items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.survey_question_options o
  SET order_index = v.order_index
  FROM (
    SELECT (e->>'id')::uuid         AS id,
           (e->>'order_index')::int AS order_index
    FROM jsonb_array_elements(items) AS e
  ) v
  WHERE o.id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_survey_options(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_survey_options(jsonb) TO authenticated;


-- ####################################################################
-- 20260717130000_question_bank_crud.sql
-- ####################################################################
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


-- ####################################################################
-- 20260717130500_seed_question_bank.sql
-- ####################################################################
-- =========================================================
-- Seed: the 8 built-in research instruments and their 128 questions.
--
-- GENERATED FILE — do not hand-edit.
-- Regenerate with: node scripts/generate-question-bank-seed.mjs
--
-- Content is copied verbatim from src/lib/instruments.ts, the static constant
-- the Question Bank rendered before it became editable, so this seed changes
-- nothing a user can see.
--
-- is_builtin marks these rows as reproductions of published instruments.
-- source_snapshot freezes each item's original wording/kind/options so the UI
-- can flag "Modified from source" and offer a one-click revert; it is derived
-- from the rows inserted here rather than restated, so it cannot disagree
-- with them.
--
-- Idempotent: ON CONFLICT on the instrument code short-circuits the whole
-- chain, because items are only inserted for instruments this run created.
-- =========================================================

WITH payload AS (
  SELECT '[{"c":"iri","n":"Interpersonal Reactivity Index (IRI)","i":0,"items":[{"k":"multiple_choice","en":"I daydream and fantasize, with some regularity, about things that might happen to me.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I often have tender, concerned feelings for people less fortunate than me.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I sometimes find it difficult to see things from the other person''s point of view.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"Sometimes I don''t feel very sorry for other people when they are having problems.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I really get involved with the feelings of the characters in a novel.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"In emergency situations, I feel apprehensive and ill-at-ease.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I am usually objective when I watch a movie or play, and I don''t often get completely caught up in it.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I try to look at everybody''s side of a disagreement before I make a decision.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I see someone being taken advantage of, I feel kind of protective towards them.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I sometimes feel helpless when I am in the middle of a very emotional situation.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I sometimes try to understand my friends better by imagining how things look from their perspective.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"Becoming extremely involved in a good book or movie is somewhat rare for me.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I see someone get hurt, I tend to remain calm.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"Other people''s misfortunes do not usually disturb me a great deal.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"If I''m sure I''m right about something, I don''t waste much time listening to other people''s arguments.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"After seeing a play or movie, I have felt as though I were one of the characters.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"Being in a tense emotional situation scares me.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I see someone being treated unfairly, I sometimes don''t feel very much pity for them.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I am usually pretty effective in dealing with emergencies.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I am often quite touched by things that I see happen.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I believe that there are two sides to every question and try to look at them both.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I would describe myself as a pretty soft-hearted person.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I watch a good movie, I can very easily put myself in the place of a leading character.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"I tend to lose control during emergencies.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I''m upset at someone, I usually try to put myself in their shoes for a while.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I am reading an interesting story or novel, I imagine how I would feel if the events in the story were happening to me.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"When I see someone who badly needs help in an emergency, I go to pieces.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]},{"k":"multiple_choice","en":"Before criticizing somebody, I try to imagine how I would feel if I were in their place.","o":[{"en":"0 — Does not describe me well","te":"0 — నన్ను సరిగ్గా వర్ణించదు"},{"en":"1","te":"1"},{"en":"2","te":"2"},{"en":"3","te":"3"},{"en":"4 — Describes me very well","te":"4 — నన్ను చాలా బాగా వర్ణిస్తుంది"}]}],"nte":"వ్యక్తుల మధ్య ప్రతిస్పందన సూచిక (IRI)","b":"28-item empathy measure — four subscales (perspective-taking, fantasy, empathic concern, personal distress).","s":"Davis, M. H. (1980)."},{"c":"cius","n":"Compulsive Internet Use Scale (CIUS)","i":1,"items":[{"k":"multiple_choice","en":"How often do you find it difficult to stop using the internet when you are online?","te":"మీరు ఆన్‌లైన్‌లో ఉన్నప్పుడు ఇంటర్నెట్ వాడకాన్ని ఆపడం ఎంత తరచుగా కష్టంగా అనిపిస్తుంది?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you continue to use the internet despite your intention to stop?","te":"ఆపాలనే ఉద్దేశం ఉన్నప్పటికీ మీరు ఎంత తరచుగా ఇంటర్నెట్ వాడకాన్ని కొనసాగిస్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do others (e.g. partner, children, parents, friends) say you should use the internet less?","te":"మీరు ఇంటర్నెట్ తక్కువగా వాడాలని ఇతరులు (భాగస్వామి, పిల్లలు, తల్లిదండ్రులు, స్నేహితులు) ఎంత తరచుగా చెబుతారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you prefer to use the internet instead of spending time with others?","te":"ఇతరులతో సమయం గడపడం కంటే ఇంటర్నెట్ వాడటానికే మీరు ఎంత తరచుగా ఇష్టపడతారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often are you short of sleep because of the internet?","te":"ఇంటర్నెట్ కారణంగా మీకు ఎంత తరచుగా నిద్ర లేమి ఏర్పడుతుంది?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you think about the internet, even when not online?","te":"ఆన్‌లైన్‌లో లేనప్పుడు కూడా ఇంటర్నెట్ గురించి ఎంత తరచుగా ఆలోచిస్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you look forward to your next internet session?","te":"మీ తదుపరి ఇంటర్నెట్ సెషన్ కోసం ఎంత తరచుగా ఎదురుచూస్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you think you should use the internet less often?","te":"మీరు ఇంటర్నెట్ తక్కువగా వాడాలని ఎంత తరచుగా అనుకుంటారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often have you unsuccessfully tried to spend less time on the internet?","te":"ఇంటర్నెట్‌పై తక్కువ సమయం గడపడానికి ఎంత తరచుగా విఫల ప్రయత్నం చేశారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you rush through your (home) work in order to go on the internet?","te":"ఇంటర్నెట్‌కు వెళ్లడానికి మీ (ఇంటి) పనిని ఎంత తరచుగా తొందరగా ముగిస్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you neglect your daily obligations (work, school or family life) because you prefer to go on the internet?","te":"ఇంటర్నెట్‌కు వెళ్లడం ఇష్టపడటం వల్ల మీ దైనందిన బాధ్యతలను (పని, పాఠశాల, కుటుంబ జీవితం) ఎంత తరచుగా నిర్లక్ష్యం చేస్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you go on the internet when you are feeling down?","te":"మీరు నిరుత్సాహంగా ఉన్నప్పుడు ఎంత తరచుగా ఇంటర్నెట్‌కు వెళ్తారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you use the internet to escape from your sorrows or get relief from negative feelings?","te":"మీ దుఃఖాల నుండి తప్పించుకోవడానికి లేదా ప్రతికూల భావాల నుండి ఉపశమనం పొందడానికి ఎంత తరచుగా ఇంటర్నెట్ వాడతారు?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]},{"k":"multiple_choice","en":"How often do you feel restless, frustrated or irritated when you cannot use the internet?","te":"ఇంటర్నెట్ వాడలేనప్పుడు మీకు ఎంత తరచుగా అశాంతి, నిరాశ లేదా చిరాకు కలుగుతుంది?","o":[{"en":"Never","te":"ఎప్పుడూ కాదు"},{"en":"Seldom","te":"అరుదుగా"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Very often","te":"చాలా తరచుగా"}]}],"nte":"నిర్బంధ ఇంటర్నెట్ వినియోగ స్కేల్ (CIUS)","b":"14-item measure of problematic internet use for private purposes.","s":"Meerkerk, G.-J., et al. (2009)."},{"c":"pid5bf","n":"Personality Inventory for DSM-5 — Brief Form (PID-5-BF)","i":2,"items":[{"k":"multiple_choice","en":"People would describe me as reckless.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I feel like I act totally on impulse.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"Even though I know better, I can''t stop making rash decisions.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I often feel like nothing I do really matters.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"Others see me as irresponsible.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I''m not good at planning ahead.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"My thoughts often don''t make sense to others.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I worry about almost everything.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I get emotional easily, often for very little reason.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I fear being alone in life more than anything else.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I get stuck on one way of doing things, even when it''s clear it won''t work.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I have seen things that weren''t really there.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I steer clear of romantic relationships.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I''m not interested in making friends.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I get irritated easily by all sorts of things.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I don''t like to get too close to people.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"It''s no big deal if I hurt other people''s feelings.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I rarely get enthusiastic about anything.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I crave attention.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I often have to deal with people who are less important than me.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I often have thoughts that make sense to me but that other people say are strange.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I use people to get what I want.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"I often “zone out” and then suddenly come to and realize that a lot of time has passed.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"Things around me often feel unreal, or more real than usual.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]},{"k":"multiple_choice","en":"It is easy for me to take advantage of others.","o":[{"en":"Very false or often false","te":"పూర్తిగా అబద్ధం / తరచుగా అబద్ధం"},{"en":"Sometimes or somewhat false","te":"కొన్నిసార్లు / కొంతవరకు అబద్ధం"},{"en":"Sometimes or somewhat true","te":"కొన్నిసార్లు / కొంతవరకు నిజం"},{"en":"Very true or often true","te":"పూర్తిగా నిజం / తరచుగా నిజం"}]}],"nte":"DSM-5 వ్యక్తిత్వ సూచిక — సంక్షిప్త రూపం (PID-5-BF)","b":"25-item screen across five personality trait domains (negative affect, detachment, antagonism, disinhibition, psychoticism).","s":"Krueger, R. F., et al. © 2013 American Psychiatric Association."},{"c":"who5","n":"WHO Well-Being Index (WHO-5)","i":3,"items":[{"k":"multiple_choice","en":"I have felt cheerful and in good spirits.","te":"నేను ఉల్లాసంగా, మంచి మనోభావంతో ఉన్నాను.","o":[{"en":"At no time","te":"ఎప్పుడూ లేదు"},{"en":"Some of the time","te":"కొంత సమయం"},{"en":"Less than half the time","te":"సగం కంటే తక్కువ సమయం"},{"en":"More than half the time","te":"సగం కంటే ఎక్కువ సమయం"},{"en":"Most of the time","te":"చాలా వరకు"},{"en":"All of the time","te":"అన్ని వేళలా"}]},{"k":"multiple_choice","en":"I have felt calm and relaxed.","te":"నేను ప్రశాంతంగా, విశ్రాంతిగా ఉన్నాను.","o":[{"en":"At no time","te":"ఎప్పుడూ లేదు"},{"en":"Some of the time","te":"కొంత సమయం"},{"en":"Less than half the time","te":"సగం కంటే తక్కువ సమయం"},{"en":"More than half the time","te":"సగం కంటే ఎక్కువ సమయం"},{"en":"Most of the time","te":"చాలా వరకు"},{"en":"All of the time","te":"అన్ని వేళలా"}]},{"k":"multiple_choice","en":"I have felt active and vigorous.","te":"నేను చురుకుగా, ఉత్సాహంగా ఉన్నాను.","o":[{"en":"At no time","te":"ఎప్పుడూ లేదు"},{"en":"Some of the time","te":"కొంత సమయం"},{"en":"Less than half the time","te":"సగం కంటే తక్కువ సమయం"},{"en":"More than half the time","te":"సగం కంటే ఎక్కువ సమయం"},{"en":"Most of the time","te":"చాలా వరకు"},{"en":"All of the time","te":"అన్ని వేళలా"}]},{"k":"multiple_choice","en":"I have felt fresh and rested.","te":"నేను తాజాగా, విశ్రాంతి తీసుకున్నట్లు అనిపించింది.","o":[{"en":"At no time","te":"ఎప్పుడూ లేదు"},{"en":"Some of the time","te":"కొంత సమయం"},{"en":"Less than half the time","te":"సగం కంటే తక్కువ సమయం"},{"en":"More than half the time","te":"సగం కంటే ఎక్కువ సమయం"},{"en":"Most of the time","te":"చాలా వరకు"},{"en":"All of the time","te":"అన్ని వేళలా"}]},{"k":"multiple_choice","en":"My daily life has been filled with things that interest me.","te":"నా దైనందిన జీవితం నాకు ఆసక్తి కలిగించే విషయాలతో నిండి ఉంది.","o":[{"en":"At no time","te":"ఎప్పుడూ లేదు"},{"en":"Some of the time","te":"కొంత సమయం"},{"en":"Less than half the time","te":"సగం కంటే తక్కువ సమయం"},{"en":"More than half the time","te":"సగం కంటే ఎక్కువ సమయం"},{"en":"Most of the time","te":"చాలా వరకు"},{"en":"All of the time","te":"అన్ని వేళలా"}]}],"nte":"WHO శ్రేయస్సు సూచిక (WHO-5)","b":"5-item well-being scale — how you have felt over the last two weeks (higher = better well-being).","s":"World Health Organization."},{"c":"trait_anger","n":"Trait Anger Scale","i":4,"items":[{"k":"multiple_choice","en":"I have a fiery temper.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I am quick-tempered.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I am a hot-headed person.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"It makes me furious when I am criticized in front of others.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I get angry when I''m slowed down by others'' mistakes.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I feel infuriated when I do a good job and get a poor evaluation.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I fly off the handle.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"I feel annoyed when I am not given recognition for doing good work.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"When I get mad, I say nasty things.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]},{"k":"multiple_choice","en":"When I get frustrated, I feel like hitting someone.","o":[{"en":"Almost never","te":"దాదాపు ఎప్పుడూ కాదు"},{"en":"Sometimes","te":"కొన్నిసార్లు"},{"en":"Often","te":"తరచుగా"},{"en":"Almost always","te":"దాదాపు ఎల్లప్పుడూ"}]}],"nte":"కోప స్వభావ స్కేల్","b":"10-item measure of how you generally feel in terms of anger.","s":"Spielberger (SUPRE-MISS)."},{"c":"impulsiveness","n":"Impulsiveness Scale (optional)","i":5,"items":[{"k":"yes_no","en":"Do you often long for excitement?"},{"k":"yes_no","en":"Do you feel at your best after taking a couple of drinks?"},{"k":"yes_no","en":"Do you save regularly?"},{"k":"yes_no","en":"Do you often buy things on impulse?"},{"k":"yes_no","en":"Do you generally do and say things without stopping to think?"},{"k":"yes_no","en":"Do you prefer quiet parties with good conversations to “wild” uninhibited ones?"},{"k":"yes_no","en":"Do you often get into a jam because you do things without thinking?"},{"k":"yes_no","en":"Would you often like to get high (drinking liquor or smoking)?"},{"k":"yes_no","en":"Are you an impulsive person?"},{"k":"yes_no","en":"Do you usually think carefully before doing anything?"},{"k":"yes_no","en":"Do you often do things on the spur of the moment?"},{"k":"yes_no","en":"Do you often enjoy breaking rules you consider unreasonable?"},{"k":"yes_no","en":"Are you rather cautious in unusual situations?"},{"k":"yes_no","en":"Do you mostly speak before thinking things out?"},{"k":"yes_no","en":"Do you often get involved in things you later wish you could get out of?"},{"k":"yes_no","en":"Do you get so carried away by new and exciting ideas that you never think of possible snags?"},{"k":"yes_no","en":"Do you get bored more easily than most people doing the same old things?"},{"k":"yes_no","en":"Would you agree that planning things ahead takes the fun out of life?"},{"k":"yes_no","en":"Do you need to use a lot of self-control to keep out of trouble?"},{"k":"yes_no","en":"Would you agree that almost everything enjoyable is illegal or immoral?"},{"k":"yes_no","en":"Are you often surprised at people''s reactions to what you do or say?"},{"k":"yes_no","en":"Do you get extremely impatient if you are kept waiting by someone who is late?"},{"k":"yes_no","en":"Do you think an evening out is more successful if it is unplanned or arranged at the last moment?"},{"k":"yes_no","en":"Do you get very restless if you have to stay around home for any length of time?"}],"nte":"ఆవేశ స్కేల్ (ఐచ్ఛికం)","b":"24-item yes/no impulsiveness measure.","s":"Eysenck & Eysenck, 1978 (SUPRE-MISS Annex 5)."},{"c":"hopelessness","n":"Hopelessness (single item)","i":6,"items":[{"k":"multiple_choice","en":"My future seems dark to me.","te":"నా భవిష్యత్తు నాకు చీకటిగా కనిపిస్తోంది.","o":[{"en":"False","te":"అబద్ధం"},{"en":"True","te":"నిజం"}]}],"nte":"నిరాశ (ఒకే ప్రశ్న)","b":"Single true/false item on outlook for the future.","s":"SUPRE-MISS §11."},{"c":"bdi","n":"Beck Depression Inventory (BDI)","i":7,"items":[{"k":"multiple_choice","en":"Sadness","o":[{"en":"I do not feel sad."},{"en":"I feel sad."},{"en":"I am sad all the time and I can''t snap out of it."},{"en":"I am so sad or unhappy that I can''t stand it."}]},{"k":"multiple_choice","en":"Pessimism","o":[{"en":"I am not particularly discouraged about the future."},{"en":"I feel discouraged about the future."},{"en":"I feel I have nothing to look forward to."},{"en":"I feel the future is hopeless and that things cannot improve."}]},{"k":"multiple_choice","en":"Sense of failure","o":[{"en":"I do not feel like a failure."},{"en":"I feel I have failed more than the average person."},{"en":"As I look back on my life, all I can see is a lot of failures."},{"en":"I feel I am a complete failure as a person."}]},{"k":"multiple_choice","en":"Loss of satisfaction","o":[{"en":"I get as much satisfaction out of things as I used to."},{"en":"I don''t enjoy things the way I used to."},{"en":"I don''t get real satisfaction out of anything anymore."},{"en":"I am dissatisfied or bored with everything."}]},{"k":"multiple_choice","en":"Guilt","o":[{"en":"I don''t feel particularly guilty."},{"en":"I feel guilty a good part of the time."},{"en":"I feel quite guilty most of the time."},{"en":"I feel guilty all of the time."}]},{"k":"multiple_choice","en":"Punishment","o":[{"en":"I don''t feel I am being punished."},{"en":"I feel I may be punished."},{"en":"I expect to be punished."},{"en":"I feel I am being punished."}]},{"k":"multiple_choice","en":"Self-dislike","o":[{"en":"I don''t feel disappointed in myself."},{"en":"I am disappointed in myself."},{"en":"I am disgusted with myself."},{"en":"I hate myself."}]},{"k":"multiple_choice","en":"Self-criticism","o":[{"en":"I don''t feel I am any worse than anybody else."},{"en":"I am critical of myself for my weaknesses or mistakes."},{"en":"I blame myself all the time for my faults."},{"en":"I blame myself for everything bad that happens."}]},{"k":"multiple_choice","en":"Suicidal thoughts","o":[{"en":"I don''t have any thoughts of killing myself."},{"en":"I have thoughts of killing myself, but I would not carry them out."},{"en":"I would like to kill myself."},{"en":"I would kill myself if I had the chance."}]},{"k":"multiple_choice","en":"Crying","o":[{"en":"I don''t cry any more than usual."},{"en":"I cry more now than I used to."},{"en":"I cry all the time now."},{"en":"I used to be able to cry, but now I can''t cry even though I want to."}]},{"k":"multiple_choice","en":"Irritability","o":[{"en":"I am no more irritated now than I ever am."},{"en":"I get annoyed or irritated more easily than I used to."},{"en":"I feel irritated all the time now."},{"en":"I don''t get irritated at all by the things that used to irritate me."}]},{"k":"multiple_choice","en":"Loss of interest","o":[{"en":"I have not lost interest in other people."},{"en":"I am less interested in other people than I used to be."},{"en":"I have lost most of my interest in other people."},{"en":"I have lost all of my interest in other people."}]},{"k":"multiple_choice","en":"Indecisiveness","o":[{"en":"I make decisions about as well as I ever did."},{"en":"I put off making decisions more than I used to."},{"en":"I have greater difficulty in making decisions than before."},{"en":"I can''t make decisions at all anymore."}]},{"k":"multiple_choice","en":"Worthlessness (appearance)","o":[{"en":"I don''t feel I look any worse than I used to."},{"en":"I am worried that I am looking old or unattractive."},{"en":"I feel there are permanent changes in my appearance that make me look unattractive."},{"en":"I believe that I look ugly."}]},{"k":"multiple_choice","en":"Loss of energy (work)","o":[{"en":"I can work about as well as before."},{"en":"It takes an extra effort to get started at doing something."},{"en":"I have to push myself very hard to do anything."},{"en":"I can''t do any work at all."}]},{"k":"multiple_choice","en":"Sleep","o":[{"en":"I can sleep as well as usual."},{"en":"I don''t sleep as well as I used to."},{"en":"I wake up 1–2 hours earlier than usual and find it hard to get back to sleep."},{"en":"I wake up several hours earlier than I used to and cannot get back to sleep."}]},{"k":"multiple_choice","en":"Tiredness","o":[{"en":"I don''t get more tired than usual."},{"en":"I get tired more easily than I used to."},{"en":"I get tired from doing almost anything."},{"en":"I am too tired to do anything."}]},{"k":"multiple_choice","en":"Appetite","o":[{"en":"My appetite is no worse than usual."},{"en":"My appetite is not as good as it used to be."},{"en":"My appetite is much worse now."},{"en":"I have no appetite at all anymore."}]},{"k":"multiple_choice","en":"Weight loss","o":[{"en":"I haven''t lost much weight, if any, lately."},{"en":"I have lost more than 5 pounds."},{"en":"I have lost more than 10 pounds."},{"en":"I have lost more than 15 pounds."}]},{"k":"multiple_choice","en":"Health worry","o":[{"en":"I am no more worried about my health than usual."},{"en":"I am worried about physical problems such as aches and pains, or upset stomach, or constipation."},{"en":"I am very worried about physical problems, and it''s hard to think of much else."},{"en":"I am so worried about my physical problems that I cannot think about anything else."}]},{"k":"multiple_choice","en":"Loss of interest in sex","o":[{"en":"I have not noticed any recent change in my interest in sex."},{"en":"I am less interested in sex than I used to be."},{"en":"I am much less interested in sex now."},{"en":"I have lost interest in sex completely."}]}],"nte":"బెక్ డిప్రెషన్ ఇన్వెంటరీ (BDI)","b":"21 grouped statements — pick the one that best represents how you feel right now.","s":"Beck (SUPRE-MISS §10)."}]'::jsonb AS doc
),
-- Instruments. A code that already exists yields no row here, and therefore no
-- items and no options either — that is what makes re-running safe.
inst AS (
  INSERT INTO public.question_bank_instruments
    (code, name_en, name_te, blurb_en, source, order_index, is_builtin, source_item_count)
  SELECT e->>'c', e->>'n', e->>'nte', e->>'b', e->>'s',
         (e->>'i')::int, true, jsonb_array_length(e->'items')
    FROM payload, jsonb_array_elements(payload.doc) AS e
  ON CONFLICT (code) DO NOTHING
  RETURNING id, code
),
-- Items. WITH ORDINALITY preserves the authored order of the JSON array as
-- order_index, so the bank lists items exactly as the static file did.
itm AS (
  INSERT INTO public.question_bank_items
    (instrument_id, order_index, kind, prompt_en, prompt_te, required, is_builtin)
  SELECT inst.id, (it.ord - 1)::int, (it.val->>'k')::public.question_kind,
         it.val->>'en', it.val->>'te', true, true
    FROM payload,
         jsonb_array_elements(payload.doc) AS e
         JOIN inst ON inst.code = e->>'c'
         CROSS JOIN LATERAL jsonb_array_elements(e->'items') WITH ORDINALITY AS it(val, ord)
  RETURNING id, instrument_id, order_index
),
-- Options, rejoined to their item by (instrument, order_index) — the pair is
-- unique within a single seed run.
opt AS (
  INSERT INTO public.question_bank_item_options (item_id, order_index, label_en, label_te)
  SELECT itm.id, (o.ord - 1)::int, o.val->>'en', o.val->>'te'
    FROM payload,
         jsonb_array_elements(payload.doc) AS e
         JOIN inst ON inst.code = e->>'c'
         CROSS JOIN LATERAL jsonb_array_elements(e->'items') WITH ORDINALITY AS it(val, ord)
         JOIN itm ON itm.instrument_id = inst.id AND itm.order_index = (it.ord - 1)
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(it.val->'o', '[]'::jsonb)) WITH ORDINALITY AS o(val, ord)
  RETURNING 1
)
SELECT count(*) AS options_inserted FROM opt;

-- Freeze the published form of every seeded item, built from the rows above so
-- the snapshot cannot drift from what it describes. Guarded on IS NULL: a
-- re-run must never re-freeze an item the user has since edited.
UPDATE public.question_bank_items i
   SET source_snapshot = jsonb_build_object(
         'prompt_en', i.prompt_en,
         'prompt_te', i.prompt_te,
         'kind',      i.kind::text,
         'options',   COALESCE((
           SELECT jsonb_agg(jsonb_build_object('label_en', o.label_en, 'label_te', o.label_te) ORDER BY o.order_index)
             FROM public.question_bank_item_options o
            WHERE o.item_id = i.id
         ), '[]'::jsonb)
       )
 WHERE i.is_builtin AND i.source_snapshot IS NULL;


-- ####################################################################
-- 20260718090000_backfill_iri_telugu.sql
-- ####################################################################
-- Backfill Telugu prompts for the IRI (Interpersonal Reactivity Index) items.
--
-- The IRI was seeded English-only, so in the guided assessment the question
-- prompt stayed in English even when the language toggle was set to Telugu
-- (renderBilingual falls back to English only when prompt_te is null). These
-- are the same Telugu strings now authored in src/lib/instruments.ts.
--
-- Idempotent: only fills rows whose prompt_te is currently null/empty, matched
-- by the exact English prompt. Runs against both the live survey questions and
-- the question-bank items so existing surveys AND future imports carry Telugu.

create temporary table _iri_te (prompt_en text primary key, prompt_te text);

insert into _iri_te (prompt_en, prompt_te) values
  ('I daydream and fantasize, with some regularity, about things that might happen to me.', 'నాకు జరగబోయే విషయాల గురించి నేను తరచుగా కలలు కంటూ ఊహించుకుంటాను.'),
  ('I often have tender, concerned feelings for people less fortunate than me.', 'నా కంటే తక్కువ అదృష్టవంతులైన వారి పట్ల నాకు తరచుగా మృదువైన, శ్రద్ధగల భావాలు కలుగుతాయి.'),
  ('I sometimes find it difficult to see things from the other person''s point of view.', 'ఎదుటివారి దృక్కోణం నుండి విషయాలను చూడటం నాకు కొన్నిసార్లు కష్టంగా అనిపిస్తుంది.'),
  ('Sometimes I don''t feel very sorry for other people when they are having problems.', 'ఇతరులు సమస్యల్లో ఉన్నప్పుడు కొన్నిసార్లు నాకు వారి పట్ల పెద్దగా జాలి కలగదు.'),
  ('I really get involved with the feelings of the characters in a novel.', 'నవలలోని పాత్రల భావాలతో నేను నిజంగా మమేకమవుతాను.'),
  ('In emergency situations, I feel apprehensive and ill-at-ease.', 'అత్యవసర పరిస్థితుల్లో నాకు ఆందోళనగా, అసౌకర్యంగా అనిపిస్తుంది.'),
  ('I am usually objective when I watch a movie or play, and I don''t often get completely caught up in it.', 'సినిమా లేదా నాటకం చూసేటప్పుడు నేను సాధారణంగా నిష్పక్షపాతంగా ఉంటాను, అందులో పూర్తిగా లీనమవను.'),
  ('I try to look at everybody''s side of a disagreement before I make a decision.', 'నిర్ణయం తీసుకునే ముందు, భిన్నాభిప్రాయంలో ప్రతి ఒక్కరి వైపు నుండి చూడటానికి ప్రయత్నిస్తాను.'),
  ('When I see someone being taken advantage of, I feel kind of protective towards them.', 'ఎవరైనా మోసానికి గురవుతుండటం చూసినప్పుడు, వారిని కాపాడాలనే భావన నాకు కలుగుతుంది.'),
  ('I sometimes feel helpless when I am in the middle of a very emotional situation.', 'చాలా భావోద్వేగకరమైన పరిస్థితి మధ్యలో ఉన్నప్పుడు కొన్నిసార్లు నాకు నిస్సహాయంగా అనిపిస్తుంది.'),
  ('I sometimes try to understand my friends better by imagining how things look from their perspective.', 'నా స్నేహితుల దృక్కోణం నుండి విషయాలు ఎలా కనిపిస్తాయో ఊహించుకుని, వారిని బాగా అర్థం చేసుకోవడానికి కొన్నిసార్లు ప్రయత్నిస్తాను.'),
  ('Becoming extremely involved in a good book or movie is somewhat rare for me.', 'మంచి పుస్తకం లేదా సినిమాలో పూర్తిగా లీనమవడం నాకు కొంతవరకు అరుదు.'),
  ('When I see someone get hurt, I tend to remain calm.', 'ఎవరైనా గాయపడటం చూసినప్పుడు, నేను ప్రశాంతంగా ఉండగలుగుతాను.'),
  ('Other people''s misfortunes do not usually disturb me a great deal.', 'ఇతరుల దురదృష్టాలు సాధారణంగా నన్ను పెద్దగా కలవరపెట్టవు.'),
  ('If I''m sure I''m right about something, I don''t waste much time listening to other people''s arguments.', 'ఒక విషయంలో నేను సరైనవాడినని నమ్మకంగా ఉంటే, ఇతరుల వాదనలు వినడానికి ఎక్కువ సమయం వృథా చేయను.'),
  ('After seeing a play or movie, I have felt as though I were one of the characters.', 'నాటకం లేదా సినిమా చూసిన తర్వాత, నేను అందులోని ఒక పాత్రలా భావించాను.'),
  ('Being in a tense emotional situation scares me.', 'ఉద్రిక్త భావోద్వేగ పరిస్థితిలో ఉండటం నన్ను భయపెడుతుంది.'),
  ('When I see someone being treated unfairly, I sometimes don''t feel very much pity for them.', 'ఎవరైనా అన్యాయానికి గురవుతుండటం చూసినప్పుడు, కొన్నిసార్లు నాకు వారి పట్ల పెద్దగా జాలి కలగదు.'),
  ('I am usually pretty effective in dealing with emergencies.', 'అత్యవసర పరిస్థితులను ఎదుర్కోవడంలో నేను సాధారణంగా చాలా సమర్థంగా ఉంటాను.'),
  ('I am often quite touched by things that I see happen.', 'నా కళ్ళ ముందు జరిగే విషయాలు తరచుగా నన్ను కదిలిస్తాయి.'),
  ('I believe that there are two sides to every question and try to look at them both.', 'ప్రతి విషయానికి రెండు వైపులు ఉంటాయని నేను నమ్ముతాను, రెండింటినీ చూడటానికి ప్రయత్నిస్తాను.'),
  ('I would describe myself as a pretty soft-hearted person.', 'నేను చాలా మృదు హృదయం గల వ్యక్తిగా నన్ను వర్ణించుకుంటాను.'),
  ('When I watch a good movie, I can very easily put myself in the place of a leading character.', 'మంచి సినిమా చూసేటప్పుడు, ప్రధాన పాత్ర స్థానంలో నన్ను నేను చాలా సులభంగా ఊహించుకోగలను.'),
  ('I tend to lose control during emergencies.', 'అత్యవసర సమయాల్లో నేను నియంత్రణ కోల్పోతాను.'),
  ('When I''m upset at someone, I usually try to put myself in their shoes for a while.', 'ఎవరిపైనైనా బాధగా ఉన్నప్పుడు, కొద్దిసేపు వారి స్థానంలో నన్ను నేను ఊహించుకోవడానికి సాధారణంగా ప్రయత్నిస్తాను.'),
  ('When I am reading an interesting story or novel, I imagine how I would feel if the events in the story were happening to me.', 'ఆసక్తికరమైన కథ లేదా నవల చదువుతున్నప్పుడు, కథలోని సంఘటనలు నాకు జరిగితే నేను ఎలా భావిస్తానో ఊహించుకుంటాను.'),
  ('When I see someone who badly needs help in an emergency, I go to pieces.', 'అత్యవసర పరిస్థితిలో సహాయం చాలా అవసరమైన వ్యక్తిని చూసినప్పుడు, నేను కలవరపడిపోతాను.'),
  ('Before criticizing somebody, I try to imagine how I would feel if I were in their place.', 'ఎవరినైనా విమర్శించే ముందు, నేను వారి స్థానంలో ఉంటే ఎలా భావిస్తానో ఊహించుకోవడానికి ప్రయత్నిస్తాను.');

update public.survey_questions q
set prompt_te = t.prompt_te
from _iri_te t
where q.prompt_en = t.prompt_en
  and (q.prompt_te is null or q.prompt_te = '');

update public.question_bank_items i
set prompt_te = t.prompt_te
from _iri_te t
where i.prompt_en = t.prompt_en
  and (i.prompt_te is null or i.prompt_te = '');

drop table _iri_te;


-- ####################################################################
-- 20260718100000_tighten_public_read_rls.sql
-- ####################################################################
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


-- ####################################################################
-- 20260718113000_submission_integrity_and_survey_limits.sql
-- ####################################################################
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




-- ####################################################################
-- 20260721094500_response_answer_metadata.sql
-- ####################################################################
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


-- ####################################################################
-- 20260721101500_family_case_workflow.sql
-- ####################################################################
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


-- ####################################################################
-- 20260722120000_restrict_family_rpcs.sql
-- ####################################################################
-- Tighten the two family RPCs.
--
-- Both were created SECURITY DEFINER and granted to `authenticated`, which is
-- broader than intended. Every table in the family schema is super-admin-only,
-- but these functions bypass RLS by design — so any signed-in account, whatever
-- its role, could call them:
--
--   family_case_stats()          leaks the size and progress of the whole
--                                caseload (how many bereaved families are
--                                enrolled, how many have completed).
--   expire_stale_family_cases()  MUTATES: it flips live cases to 'expired',
--                                which would cut families off mid-assessment.
--
-- A SECURITY DEFINER function has to do its own authorisation, because there is
-- no RLS left to do it for them. Both now check the caller's role first.
--
-- Found by the Supabase security advisor after the schema went live, not by any
-- test — a grant that is too wide is invisible to a type checker and to every
-- test that runs as an administrator.

CREATE OR REPLACE FUNCTION public.expire_stale_family_cases()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = 'insufficient_privilege';
  END IF;

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

-- Rewritten as plpgsql so it can guard before it reads. A `LANGUAGE sql` body
-- cannot branch, so the authorisation check has to live in a procedural body.
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    count(*),
    count(*) FILTER (WHERE fc.status = 'not_started'),
    count(*) FILTER (WHERE fc.status IN ('opened', 'reopened')),
    count(*) FILTER (WHERE fc.status = 'in_progress'),
    count(*) FILTER (WHERE fc.status = 'completed'),
    count(*) FILTER (WHERE fc.status = 'expired'),
    count(*) FILTER (WHERE fc.status = 'completed' AND fc.completed_at::date = now()::date),
    (SELECT avg(r.duration_seconds) FROM public.survey_responses r
      WHERE r.family_case_id IS NOT NULL AND r.duration_seconds IS NOT NULL)
  FROM public.family_cases fc;
END;
$$;

-- anon never had these; state it explicitly so a future blanket GRANT cannot
-- quietly hand a public role a caseload aggregate.
REVOKE ALL ON FUNCTION public.expire_stale_family_cases() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.family_case_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_family_cases() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.family_case_stats() TO authenticated, service_role;


-- ####################################################################
-- 20260722134500_split_assessment_into_modules.sql
-- ####################################################################
-- =========================================================
-- Split the 128-question "Family & Well-being Assessment" into
-- seven publishable modules, none larger than 25 questions.
--
-- WHY
-- The single assessment carried every item of all eight source
-- instruments end to end: 128 screens in one sitting. A grieving
-- household cannot be asked for that, and the published-survey
-- limit existed precisely to prevent it (it was 20, and the legacy
-- survey predated the trigger).
--
-- WHAT IS KEPT
-- Every one of the 128 questions survives, with its wording, its
-- kind, its Telugu, and its own response anchors — copied straight
-- out of question_bank_items / question_bank_item_options, so a
-- module reflects whatever the Question Bank holds today (including
-- the IRI Telugu backfill), not a restated copy that could drift.
--
-- HOW IT DIVIDES
-- Instrument boundaries are respected. Seven of the eight instruments
-- fit under 25 items and are never cut. Only the IRI (28) exceeds the
-- cap, and it splits along its own published subscale structure:
--
--   Part 1 = Perspective Taking + Fantasy      (14) — cognitive empathy
--   Part 2 = Empathic Concern + Personal Distress (14) — affective empathy
--
-- Within each part the items keep their original IRI numbering order,
-- because Davis interleaves the subscales deliberately to blunt
-- response bias; regrouping them by subscale would undo that.
--
--   1 Well-being & Everyday Mood      WHO-5 + Hopelessness + Trait Anger   16
--   2 Mood & Daily Functioning        BDI                                  21
--   3 Understanding Others — Part 1   IRI (PT + FS)                        14
--   4 Understanding Others — Part 2   IRI (EC + PD)                        14
--   5 Internet & Screen Habits        CIUS                                 14
--   6 Everyday Decisions & Impulses   Impulsiveness                        24
--   7 Personality Style               PID-5-BF                             25
--                                                                     total 128
--
-- Each source instrument becomes a section, so which validated
-- instrument an answer belongs to stays legible in the builder, the
-- respondent flow and every export.
--
-- The legacy 128-question survey is set to 'closed', not deleted: it
-- keeps its slug and its questions, disappears from the officer's
-- "choose a published assessment" list, and reopenSurvey() puts it
-- back in one click.
--
-- Idempotent: a module whose slug already exists is skipped whole.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Raise the published-survey ceiling 20 -> 25.
--    PID-5-BF is exactly 25 items and must not be cut in half;
--    25 is the point where a module still fits one sitting.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_published_survey_question_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE question_total integer;
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.id;
  IF question_total > 25 THEN
    RAISE EXCEPTION 'Published surveys are limited to 25 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.enforce_question_limit_on_question_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE question_total integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.surveys WHERE id = NEW.survey_id AND status = 'published') THEN
    SELECT count(*) INTO question_total FROM public.survey_questions WHERE survey_id = NEW.survey_id;
    IF question_total >= 25 THEN
      RAISE EXCEPTION 'Published surveys are limited to 25 questions; split this survey into reviewed modules.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------
-- 2. Build the modules from the Question Bank.
-- ---------------------------------------------------------
DO $mig$
DECLARE
  -- "items" lists question_bank_items.order_index values (0-based) and is
  -- present only where a section takes a subset. Absent = the whole instrument.
  spec jsonb := $spec$
[
  {
    "slug": "wellbeing-mood",
    "title_en": "Well-being & Everyday Mood",
    "title_te": "శ్రేయస్సు మరియు దైనందిన మనోభావం",
    "desc_en": "How you have been feeling recently — your general well-being, your outlook on the future, and how you experience anger. 16 questions, about 5 minutes.",
    "desc_te": "ఇటీవల మీరు ఎలా భావిస్తున్నారు — మీ సాధారణ శ్రేయస్సు, భవిష్యత్తుపై మీ దృక్పథం, కోపాన్ని మీరు ఎలా అనుభవిస్తారు. 16 ప్రశ్నలు, సుమారు 5 నిమిషాలు.",
    "sections": [{ "code": "who5" }, { "code": "hopelessness" }, { "code": "trait_anger" }]
  },
  {
    "slug": "mood-daily-functioning",
    "title_en": "Mood & Daily Functioning",
    "title_te": "మనోభావం మరియు దైనందిన కార్యకలాపాలు",
    "desc_en": "For each group of statements, choose the one that best describes how you have been feeling. 21 questions, about 8 minutes.",
    "desc_te": "ప్రతి ప్రకటనల సమూహంలో, మీరు ఎలా భావిస్తున్నారో బాగా వర్ణించే దానిని ఎంచుకోండి. 21 ప్రశ్నలు, సుమారు 8 నిమిషాలు.",
    "sections": [{ "code": "bdi" }]
  },
  {
    "slug": "understanding-others-1",
    "title_en": "Understanding Others — Part 1",
    "title_te": "ఇతరులను అర్థం చేసుకోవడం — భాగం 1",
    "desc_en": "How you take another person's point of view, and how far you are drawn into stories and films. 14 questions, about 5 minutes.",
    "desc_te": "మీరు ఎదుటివారి దృక్కోణాన్ని ఎలా తీసుకుంటారు, కథలు మరియు సినిమాల్లో ఎంతగా లీనమవుతారు. 14 ప్రశ్నలు, సుమారు 5 నిమిషాలు.",
    "sections": [
      {
        "code": "iri",
        "title_en": "Interpersonal Reactivity Index — perspective taking & fantasy",
        "title_te": "వ్యక్తుల మధ్య ప్రతిస్పందన సూచిక — దృక్కోణ స్వీకరణ మరియు ఊహాశక్తి",
        "items": [0, 2, 4, 6, 7, 10, 11, 14, 15, 20, 22, 24, 25, 27]
      }
    ]
  },
  {
    "slug": "understanding-others-2",
    "title_en": "Understanding Others — Part 2",
    "title_te": "ఇతరులను అర్థం చేసుకోవడం — భాగం 2",
    "desc_en": "How you respond to other people's feelings, and how you feel in tense or emergency situations. 14 questions, about 5 minutes.",
    "desc_te": "ఇతరుల భావాలకు మీరు ఎలా స్పందిస్తారు, ఉద్రిక్త లేదా అత్యవసర పరిస్థితుల్లో ఎలా భావిస్తారు. 14 ప్రశ్నలు, సుమారు 5 నిమిషాలు.",
    "sections": [
      {
        "code": "iri",
        "title_en": "Interpersonal Reactivity Index — empathic concern & personal distress",
        "title_te": "వ్యక్తుల మధ్య ప్రతిస్పందన సూచిక — సహానుభూతి మరియు వ్యక్తిగత ఆందోళన",
        "items": [1, 3, 5, 8, 9, 12, 13, 16, 17, 18, 19, 21, 23, 26]
      }
    ]
  },
  {
    "slug": "internet-screen-habits",
    "title_en": "Internet & Screen Habits",
    "title_te": "ఇంటర్నెట్ మరియు స్క్రీన్ అలవాట్లు",
    "desc_en": "How internet use fits into your day. 14 questions, about 4 minutes.",
    "desc_te": "మీ రోజులో ఇంటర్నెట్ వాడకం ఎలా ఇమిడి ఉంది. 14 ప్రశ్నలు, సుమారు 4 నిమిషాలు.",
    "sections": [{ "code": "cius" }]
  },
  {
    "slug": "decisions-and-impulses",
    "title_en": "Everyday Decisions & Impulses",
    "title_te": "దైనందిన నిర్ణయాలు మరియు ఆవేశాలు",
    "desc_en": "Yes or no questions about how you make everyday decisions. 24 questions, about 6 minutes.",
    "desc_te": "మీరు దైనందిన నిర్ణయాలు ఎలా తీసుకుంటారనే దానిపై అవును లేదా కాదు ప్రశ్నలు. 24 ప్రశ్నలు, సుమారు 6 నిమిషాలు.",
    "sections": [{ "code": "impulsiveness" }]
  },
  {
    "slug": "personality-style",
    "title_en": "Personality Style",
    "title_te": "వ్యక్తిత్వ శైలి",
    "desc_en": "How true each statement is of you, generally. 25 questions, about 7 minutes.",
    "desc_te": "సాధారణంగా ప్రతి ప్రకటన మీకు ఎంత నిజమో. 25 ప్రశ్నలు, సుమారు 7 నిమిషాలు.",
    "sections": [{ "code": "pid5bf" }]
  }
]
$spec$::jsonb;

  module      jsonb;
  sec         jsonb;
  item        record;
  v_survey    uuid;
  v_section   uuid;
  v_question  uuid;
  sec_order   int;
  q_order     int;
  built       int := 0;
BEGIN
  FOR module IN SELECT * FROM jsonb_array_elements(spec) LOOP
    -- Idempotence: the slug is the module's identity.
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.surveys WHERE slug = module->>'slug');

    -- Created as a draft so the per-question limit trigger stays out of the
    -- way; published at the end, where the >25 check runs once against the
    -- finished module.
    INSERT INTO public.surveys (title_en, title_te, description_en, description_te, status)
    VALUES (module->>'title_en', module->>'title_te', module->>'desc_en', module->>'desc_te', 'draft')
    RETURNING id INTO v_survey;

    sec_order := 0;
    q_order   := 0;

    FOR sec IN SELECT * FROM jsonb_array_elements(module->'sections') LOOP
      -- A section titled after its source instrument unless the module
      -- overrides it (the two IRI halves need to say which subscales they are).
      INSERT INTO public.survey_sections (survey_id, order_index, title_en, title_te, description_en, description_te)
      SELECT v_survey,
             sec_order,
             COALESCE(sec->>'title_en', qi.name_en),
             COALESCE(sec->>'title_te', qi.name_te),
             qi.blurb_en,
             qi.blurb_te
      FROM public.question_bank_instruments qi
      WHERE qi.code = sec->>'code' AND qi.is_builtin
      RETURNING id INTO v_section;

      IF v_section IS NULL THEN
        RAISE EXCEPTION 'Question Bank instrument % is missing; cannot build module %',
          sec->>'code', module->>'slug';
      END IF;

      FOR item IN
        SELECT it.id, it.order_index, it.kind, it.prompt_en, it.prompt_te, it.required
        FROM public.question_bank_items it
        JOIN public.question_bank_instruments qi ON qi.id = it.instrument_id
        WHERE qi.code = sec->>'code'
          AND qi.is_builtin
          -- IS DISTINCT FROM, not <>: a section with no "items" key yields
          -- jsonb_typeof(NULL) = NULL, and NULL <> 'array' is NULL, which
          -- would silently select nothing for every whole-instrument module.
          AND (
            jsonb_typeof(sec->'items') IS DISTINCT FROM 'array'
            OR it.order_index IN (
              SELECT t.value::int FROM jsonb_array_elements_text(sec->'items') AS t(value)
            )
          )
        ORDER BY it.order_index
      LOOP
        INSERT INTO public.survey_questions
          (survey_id, section_id, order_index, kind, prompt_en, prompt_te, required)
        VALUES
          (v_survey, v_section, q_order, item.kind, item.prompt_en, item.prompt_te, item.required)
        RETURNING id INTO v_question;

        -- Every item carries its instrument's own anchors, so options are
        -- copied per question rather than shared.
        INSERT INTO public.survey_question_options (question_id, order_index, label_en, label_te)
        SELECT v_question, o.order_index, o.label_en, o.label_te
        FROM public.question_bank_item_options o
        WHERE o.item_id = item.id
        ORDER BY o.order_index;

        q_order := q_order + 1;
      END LOOP;

      sec_order := sec_order + 1;
    END LOOP;

    IF q_order = 0 THEN
      RAISE EXCEPTION 'Module % came out empty', module->>'slug';
    END IF;
    IF q_order > 25 THEN
      RAISE EXCEPTION 'Module % has % questions, over the 25 limit', module->>'slug', q_order;
    END IF;

    UPDATE public.surveys
    SET status = 'published', slug = module->>'slug', published_at = now()
    WHERE id = v_survey;

    built := built + 1;
    RAISE NOTICE 'Module % published with % questions', module->>'slug', q_order;
  END LOOP;

  RAISE NOTICE 'Built % module(s)', built;
END;
$mig$;

-- ---------------------------------------------------------
-- 3. Retire the 128-question original.
--    'closed' is the app's own archive state (closeSurvey in
--    src/lib/surveys.ts): the family-access edge function refuses any
--    survey that is not 'published', and FamilyCaseDialog only offers
--    published ones — so no officer can assign it and no family can be
--    sent it, while every question and the slug stay on disk.
--    Guarded on the question count so this cannot close a module.
-- ---------------------------------------------------------
UPDATE public.surveys s
SET status = 'closed'
WHERE s.slug = 'wellbeing'
  AND s.status = 'published'
  AND (SELECT count(*) FROM public.survey_questions q WHERE q.survey_id = s.id) > 25;


-- ####################################################################
-- 20260722151500_digital_use_interview_module.sql
-- ####################################################################
-- =========================================================
-- The ninth instrument: Digital Use Interview (study document 5).
--
-- WHY THIS EXISTS
-- The Question Bank was seeded from src/lib/instruments.ts, which held eight
-- instruments and 128 items. The prototype's legacy clinical tables
-- (public.instruments / instrument_items / scales / scale_options) hold NINE
-- instruments and 150 items. The ninth — code 'INTERVIEW', "5 · Digital Use
-- Interview", 22 items — was never carried across, because the bank was
-- deliberately seeded from the static file rather than from those tables
-- (see 20260717130000_question_bank_crud.sql). So 22 authored, fully
-- translated questions have been sitting outside the product since then.
--
-- This migration restates those 22 items rather than copying them out of the
-- legacy tables. The legacy tables were created by migrations that live only
-- in the remote project, never in this repo, so a `supabase db push` against a
-- fresh database would not have them and a copy would fail. Restating keeps
-- the migration self-contained, exactly like the original bank seed.
--
-- WHAT IT IS
-- A descriptive profile, not a scored scale: what the household owns, which
-- apps are used, and how many hours a day go to screens. The legacy row
-- records scoring method "none", so no subscale or reverse-scoring key is
-- lost by moving it. Ownership and app items are yes/no; frequency and
-- duration items carry their own anchors, so kind is set per item.
--
-- English and Telugu both come from the legacy rows verbatim. (Hindi is in
-- those rows too, but this platform is EN/TE only, so it is not carried.)
--
-- The 22 items fit under the 25-question cap, so this is one module of 22,
-- split into four sections that follow the interview's own blocks.
--
-- Idempotent: keyed on the instrument code and the survey slug.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Seed the instrument into the Question Bank.
-- ---------------------------------------------------------
DO $mig$
DECLARE
  spec jsonb := $spec$
[
  { "k": "yes_no", "en": "Do you have a Non-smart TV at home?",        "te": "మీ ఇంట్లో నాన్-స్మార్ట్ TV ఉందా?" },
  { "k": "yes_no", "en": "Do you have a Smart TV at home?",            "te": "మీ ఇంట్లో స్మార్ట్ TV ఉందా?" },
  { "k": "yes_no", "en": "Do you have a Smartphone at home?",          "te": "మీ ఇంట్లో స్మార్ట్‌ఫోన్ ఉందా?" },
  { "k": "yes_no", "en": "Do you have a Computer / Laptop at home?",   "te": "మీ ఇంట్లో కంప్యూటర్ / ల్యాప్‌టాప్ ఉందా?" },
  { "k": "yes_no", "en": "Do you have a Tablet / iPad at home?",       "te": "మీ ఇంట్లో ట్యాబ్లెట్ / iPad ఉందా?" },
  { "k": "yes_no", "en": "Do you have a Videogame console at home?",   "te": "మీ ఇంట్లో వీడియోగేమ్ కన్సోల్ ఉందా?" },
  { "k": "yes_no", "en": "Do you have a WiFi / Broadband at home?",    "te": "మీ ఇంట్లో వైఫై / బ్రాడ్‌బ్యాండ్ ఉందా?" },
  { "k": "yes_no", "en": "Do you have a eBook reader at home?",        "te": "మీ ఇంట్లో ఈబుక్ రీడర్ ఉందా?" },

  { "k": "multiple_choice", "en": "In the last month, how often did you use a Smart TV?",
    "te": "గత నెలలో, మీరు స్మార్ట్ TV ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },
  { "k": "multiple_choice", "en": "In the last month, how often did you use a Smartphone?",
    "te": "గత నెలలో, మీరు స్మార్ట్‌ఫోన్ ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },
  { "k": "multiple_choice", "en": "In the last month, how often did you use a Computer / Laptop?",
    "te": "గత నెలలో, మీరు కంప్యూటర్ / ల్యాప్‌టాప్ ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },
  { "k": "multiple_choice", "en": "In the last month, how often did you use a Tablet / iPad?",
    "te": "గత నెలలో, మీరు ట్యాబ్లెట్ / iPad ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },
  { "k": "multiple_choice", "en": "In the last month, how often did you use a Videogame console?",
    "te": "గత నెలలో, మీరు వీడియోగేమ్ కన్సోల్ ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },
  { "k": "multiple_choice", "en": "In the last month, how often did you use a eBook reader?",
    "te": "గత నెలలో, మీరు ఈబుక్ రీడర్ ఎంత తరచుగా ఉపయోగించారు?", "o": "freq" },

  { "k": "yes_no", "en": "Do you use YouTube?",                        "te": "మీరు YouTube ఉపయోగిస్తారా?" },
  { "k": "yes_no", "en": "Do you use WhatsApp?",                       "te": "మీరు WhatsApp ఉపయోగిస్తారా?" },
  { "k": "yes_no", "en": "Do you use Facebook?",                       "te": "మీరు Facebook ఉపయోగిస్తారా?" },
  { "k": "yes_no", "en": "Do you use Instagram?",                      "te": "మీరు Instagram ఉపయోగిస్తారా?" },
  { "k": "yes_no", "en": "Do you use Snapchat?",                       "te": "మీరు Snapchat ఉపయోగిస్తారా?" },
  { "k": "yes_no", "en": "Do you use Netflix / Amazon Prime / Zee5?",  "te": "మీరు Netflix / Amazon Prime / Zee5 ఉపయోగిస్తారా?" },

  { "k": "multiple_choice", "en": "On weekdays, about how many hours a day do you use digital devices?",
    "te": "వారపు రోజుల్లో, మీరు రోజుకు ఎన్ని గంటలు డిజిటల్ పరికరాలను ఉపయోగిస్తారు?", "o": "hours" },
  { "k": "multiple_choice", "en": "On weekends, about how many hours a day do you use digital devices?",
    "te": "వారాంతంలో, మీరు రోజుకు ఎన్ని గంటలు డిజిటల్ పరికరాలను ఉపయోగిస్తారు?", "o": "hours" }
]
$spec$::jsonb;

  scales jsonb := $scales$
{
  "freq": [
    { "en": "Every day, or almost every day", "te": "ప్రతిరోజూ, లేదా దాదాపు ప్రతిరోజూ" },
    { "en": "4–5 days a week",                "te": "వారానికి 4–5 రోజులు" },
    { "en": "2–3 days a week",                "te": "వారానికి 2–3 రోజులు" },
    { "en": "1 day or less per week",         "te": "వారానికి 1 రోజు లేదా అంతకంటే తక్కువ" },
    { "en": "Never",                          "te": "ఎప్పుడూ కాదు" }
  ],
  "hours": [
    { "en": "None",              "te": "ఏమీ లేదు" },
    { "en": "Less than 30 min",  "te": "30 నిమిషాల కంటే తక్కువ" },
    { "en": "30 min to 1 hour",  "te": "30 నిమిషాల నుండి 1 గంట" },
    { "en": "1 to 2 hours",      "te": "1 నుండి 2 గంటలు" },
    { "en": "2 to 3 hours",      "te": "2 నుండి 3 గంటలు" },
    { "en": "3 to 4 hours",      "te": "3 నుండి 4 గంటలు" },
    { "en": "4 to 5 hours",      "te": "4 నుండి 5 గంటలు" },
    { "en": "More than 5 hours", "te": "5 గంటల కంటే ఎక్కువ" }
  ]
}
$scales$::jsonb;

  v_inst uuid;
  v_item uuid;
  it     jsonb;
  idx    int := 0;
BEGIN
  SELECT id INTO v_inst FROM public.question_bank_instruments WHERE code = 'digital_use';
  IF v_inst IS NOT NULL THEN
    RAISE NOTICE 'digital_use already in the bank; skipping seed';
  ELSE
    INSERT INTO public.question_bank_instruments
      (code, name_en, name_te, blurb_en, blurb_te, source, order_index, is_builtin, source_item_count)
    VALUES (
      'digital_use',
      'Digital Use Interview',
      'డిజిటల్ వినియోగ ఇంటర్వ్యూ',
      '22-item descriptive profile of digital devices owned, apps used and daily screen time. Not scored.',
      'ఇంట్లోని డిజిటల్ పరికరాలు, ఉపయోగించే యాప్‌లు మరియు రోజువారీ స్క్రీన్ సమయంపై 22 ప్రశ్నల వివరణాత్మక ప్రొఫైల్.',
      'Semi-structured Interview — Usage patterns of Digital Technologies & Cyberspace (study document 5).',
      (SELECT COALESCE(max(order_index), -1) + 1 FROM public.question_bank_instruments),
      true,
      jsonb_array_length(spec)
    )
    RETURNING id INTO v_inst;

    FOR it IN SELECT * FROM jsonb_array_elements(spec) LOOP
      INSERT INTO public.question_bank_items
        (instrument_id, order_index, kind, prompt_en, prompt_te, required, is_builtin)
      VALUES
        (v_inst, idx, (it->>'k')::public.question_kind, it->>'en', it->>'te', true, true)
      RETURNING id INTO v_item;

      -- yes_no carries no options: the renderer draws its own Yes/No, exactly
      -- as the seeded Impulsiveness items do. Only the two named scales expand.
      -- `it->>'o' IS NOT NULL` rather than the `?` existence operator, which
      -- some drivers read as a bind placeholder.
      IF it->>'o' IS NOT NULL THEN
        INSERT INTO public.question_bank_item_options (item_id, order_index, label_en, label_te)
        SELECT v_item, (o.ord - 1)::int, o.val->>'en', o.val->>'te'
        FROM jsonb_array_elements(scales->(it->>'o')) WITH ORDINALITY AS o(val, ord);
      END IF;

      -- Freeze the published form, derived from the rows just written so it
      -- cannot disagree with them — the same contract the original seed uses,
      -- and what makes "Modified from source" and revert work for these items.
      UPDATE public.question_bank_items qi
      SET source_snapshot = jsonb_build_object(
            'prompt_en', qi.prompt_en,
            'prompt_te', qi.prompt_te,
            'kind',      qi.kind,
            'options',   COALESCE((
              SELECT jsonb_agg(jsonb_build_object('label_en', o.label_en, 'label_te', o.label_te)
                               ORDER BY o.order_index)
              FROM public.question_bank_item_options o WHERE o.item_id = qi.id
            ), '[]'::jsonb))
      WHERE qi.id = v_item;

      idx := idx + 1;
    END LOOP;

    RAISE NOTICE 'Seeded digital_use with % items', idx;
  END IF;
END;
$mig$;

-- ---------------------------------------------------------
-- 2. Build the eighth module from it.
--    Same shape as 20260722134500: sections carry the interview's own
--    blocks, order_index runs contiguously across the whole module.
-- ---------------------------------------------------------
DO $mig$
DECLARE
  sections jsonb := $sec$
[
  { "title_en": "Devices at home",
    "title_te": "ఇంట్లోని పరికరాలు",
    "items": [0, 1, 2, 3, 4, 5, 6, 7] },
  { "title_en": "How often you use each device",
    "title_te": "ప్రతి పరికరాన్ని ఎంత తరచుగా ఉపయోగిస్తారు",
    "items": [8, 9, 10, 11, 12, 13] },
  { "title_en": "Apps and services you use",
    "title_te": "మీరు ఉపయోగించే యాప్‌లు మరియు సేవలు",
    "items": [14, 15, 16, 17, 18, 19] },
  { "title_en": "Time spent on screens",
    "title_te": "స్క్రీన్‌లపై గడిపే సమయం",
    "items": [20, 21] }
]
$sec$::jsonb;

  sec        jsonb;
  item       record;
  v_survey   uuid;
  v_section  uuid;
  v_question uuid;
  sec_order  int := 0;
  q_order    int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.surveys WHERE slug = 'digital-device-use') THEN
    RAISE NOTICE 'digital-device-use module already exists; skipping';
    RETURN;
  END IF;

  INSERT INTO public.surveys (title_en, title_te, description_en, description_te, status)
  VALUES (
    'Digital Devices & Screen Use',
    'డిజిటల్ పరికరాలు మరియు స్క్రీన్ వినియోగం',
    'What digital devices your household has, which apps you use, and how much time you spend on screens. 22 questions, about 5 minutes.',
    'మీ ఇంట్లో ఏ డిజిటల్ పరికరాలు ఉన్నాయి, మీరు ఏ యాప్‌లు ఉపయోగిస్తారు, స్క్రీన్‌లపై ఎంత సమయం గడుపుతారు. 22 ప్రశ్నలు, సుమారు 5 నిమిషాలు.',
    'draft'
  )
  RETURNING id INTO v_survey;

  FOR sec IN SELECT * FROM jsonb_array_elements(sections) LOOP
    INSERT INTO public.survey_sections (survey_id, order_index, title_en, title_te)
    VALUES (v_survey, sec_order, sec->>'title_en', sec->>'title_te')
    RETURNING id INTO v_section;

    FOR item IN
      SELECT it.id, it.kind, it.prompt_en, it.prompt_te, it.required, it.order_index
      FROM public.question_bank_items it
      JOIN public.question_bank_instruments qi ON qi.id = it.instrument_id
      WHERE qi.code = 'digital_use'
        AND it.order_index IN (
          SELECT t.value::int FROM jsonb_array_elements_text(sec->'items') AS t(value)
        )
      ORDER BY it.order_index
    LOOP
      INSERT INTO public.survey_questions
        (survey_id, section_id, order_index, kind, prompt_en, prompt_te, required)
      VALUES
        (v_survey, v_section, q_order, item.kind, item.prompt_en, item.prompt_te, item.required)
      RETURNING id INTO v_question;

      INSERT INTO public.survey_question_options (question_id, order_index, label_en, label_te)
      SELECT v_question, o.order_index, o.label_en, o.label_te
      FROM public.question_bank_item_options o
      WHERE o.item_id = item.id
      ORDER BY o.order_index;

      q_order := q_order + 1;
    END LOOP;

    sec_order := sec_order + 1;
  END LOOP;

  IF q_order <> 22 THEN
    RAISE EXCEPTION 'Expected 22 questions in the digital-use module, built %', q_order;
  END IF;

  UPDATE public.surveys
  SET status = 'published', slug = 'digital-device-use', published_at = now()
  WHERE id = v_survey;

  RAISE NOTICE 'Module digital-device-use published with % questions', q_order;
END;
$mig$;


-- ####################################################################
-- 20260722160000_family_access_phone_only.sql
-- ####################################################################
-- Sign-in becomes: the secure link, plus the family's own phone number.
--
-- The 6-digit PIN is removed at the product owner's direction: a family should
-- type one thing they already know, not a code off a slip they can lose.
--
-- What that means for the threat model, stated plainly because the next person
-- to read this needs to know exactly what is and is not protecting the data:
--
--   A phone number is NOT a secret. It is on the case file, known to relatives
--   and neighbours, and a 10-digit Indian mobile is guessable within a district.
--   So the phone number cannot be the thing that keeps a stranger out.
--
--   The ACCESS TOKEN is. It is 22 characters from a 31-symbol alphabet (~109
--   bits), minted per case, and it only ever exists on the printed slip and in
--   the QR. Login therefore REQUIRES the token; the phone is a second factor
--   that confirms the right family is holding the right slip.
--
-- Hence: the PIN column is retired, but the login path is NOT loosened to
-- "phone alone". Anything that made /family reachable without a token would
-- make every household's answers readable to anyone who can guess a number.

-- Login no longer resolves a (phone, pin) pair, so that pair need not be unique.
DROP INDEX IF EXISTS public.uq_family_cases_phone_pin;

-- Kept, not dropped: existing rows keep whatever PIN they were issued, and an
-- audit trail that references pin_viewed stays meaningful. New cases simply
-- leave it NULL.
ALTER TABLE public.family_cases ALTER COLUMN pin DROP NOT NULL;
ALTER TABLE public.family_cases ALTER COLUMN pin DROP DEFAULT;

ALTER TABLE public.family_cases DROP CONSTRAINT IF EXISTS family_cases_pin_check;
ALTER TABLE public.family_cases
  ADD CONSTRAINT family_cases_pin_check CHECK (pin IS NULL OR pin ~ '^[0-9]{6}$');

COMMENT ON COLUMN public.family_cases.pin IS
  'Retired. Sign-in is access_token + phone. NULL on every case created after 2026-07-22.';
COMMENT ON COLUMN public.family_cases.access_token IS
  'THE credential. ~109 bits of entropy, per case, on the printed slip and in the QR. The phone number confirms identity but is not secret and must never be sufficient on its own.';

-- One family, one live case per assigned survey. With the PIN gone the token
-- identifies the case and the phone confirms it, so two open cases for the same
-- household on the same instrument would make "which one did they just answer"
-- ambiguous. Completed and expired rows are excluded so a legitimate re-run is
-- still possible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_cases_active_phone_survey
  ON public.family_cases (phone, survey_id)
  WHERE status IN ('not_started', 'opened', 'in_progress', 'reopened');


-- ####################################################################
-- 20260722163000_lock_down_legacy_rpc_surface.sql
-- ####################################################################
-- =========================================================
-- Close the legacy prototype's API surface.
--
-- THE PROBLEM
-- An earlier "psydigihealth" prototype left a complete second application
-- behind in this database: participants, responses, scores, consents,
-- notifications — and a set of SECURITY DEFINER functions that PostgREST
-- exposes as RPC endpoints callable by `anon`, i.e. by anyone holding the
-- publishable key that ships in the browser bundle. Among them:
--
--   patient_portal(p_code, p_dob)   — authenticates a participant from a code
--                                     and a date of birth, both low-entropy
--   get_survey(p_token)             — reads an assignment's whole instrument
--   save_response(p_token, ...)     — writes answers
--   complete_survey(p_token)        — marks an assignment finished
--   demo_register(...)              — inserts a participant row
--   demo_consent(...)               — records a consent decision
--   demo_batches() / demo_catalogue()
--   due_reminders(p_secret)         — shared-secret gated, still anon-callable
--   log_notification(p_secret, ...) — same
--
-- Because they are SECURITY DEFINER they run as their owner and bypass RLS
-- entirely, so the tables' policies are not a second line of defence. Those
-- tables are not empty: they hold real participant, response and consent rows.
--
-- None of this is reachable from the product. The app is the survey/family-case
-- model, and it calls none of these — verified by grep across src/ and
-- supabase/functions/; the names appear only in the generated types file.
-- They are pure attack surface: an unauthenticated second door into
-- participant data, sitting beside the deliberately narrow family-access
-- function that the current design depends on.
--
-- THE FIX
-- Revoke EXECUTE from PUBLIC, anon and authenticated. The functions and their
-- data stay exactly as they are — only the ability to call them over the API
-- goes. service_role and the owner are unaffected, so anything server-side
-- still works and nothing is destroyed. Re-granting is a one-line revert.
--
-- Also flips three SECURITY DEFINER views to security_invoker. A definer view
-- applies its CREATOR's permissions and RLS to every reader, which is the same
-- privilege-escalation shape in view form.
--
-- Written as catalogue-driven loops, not a hardcoded list: these objects were
-- created by migrations that live only in the remote project and have never
-- been in this repo, so a fresh `supabase db push` has none of them. A literal
-- REVOKE would fail there. This finds what exists and leaves the rest alone.
-- Idempotent.
-- =========================================================

DO $mig$
DECLARE
  f record;
  n int := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prosecdef                       -- SECURITY DEFINER only
      AND p.proname IN (
        'patient_portal',
        'get_survey',
        'save_response',
        'complete_survey',
        'demo_register',
        'demo_consent',
        'demo_batches',
        'demo_catalogue',
        'due_reminders',
        'log_notification'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    n := n + 1;
    RAISE NOTICE 'revoked %', f.sig;
  END LOOP;
  RAISE NOTICE 'legacy RPCs closed: %', n;
END;
$mig$;

-- Trigger functions are not callable as RPC in any useful way, but PostgREST
-- still advertises them. Nothing should hold EXECUTE on a trigger function.
DO $mig$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE ns.nspname = 'public' AND t.typname = 'trigger'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END;
$mig$;

-- SECURITY DEFINER views → security_invoker, so a reader sees only what their
-- own grants and RLS allow rather than the view owner's.
DO $mig$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['study_scores', 'study_participants', 'study_assignments'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = v
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
      RAISE NOTICE 'view %: security_invoker on, anon revoked', v;
    END IF;
  END LOOP;
END;
$mig$;


-- ####################################################################
-- 20260722163500_rls_initplan_and_indexes.sql
-- ####################################################################
-- =========================================================
-- Make every admin query stop re-checking the caller's role once per row.
--
-- THE PROBLEM
-- 43 policies are written as:
--
--     USING (has_role(auth.uid(), 'super_admin'))
--
-- Both `auth.uid()` and `has_role()` are STABLE, not IMMUTABLE, and they appear
-- as a plain function call in the policy expression. Postgres therefore
-- evaluates the pair FOR EVERY ROW the statement touches. `has_role` is itself
-- a lookup into user_roles, so reading N rows from survey_questions costs N
-- extra index probes purely to re-answer a question whose answer cannot change
-- during the statement.
--
-- THE FIX
-- Wrap the check in a scalar subquery:
--
--     USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin')))
--
-- A subquery with no outer references is hoisted into an InitPlan and executed
-- ONCE per statement, its result reused for every row. This is the documented
-- Supabase remedy for the `auth_rls_initplan` lint. The predicate is logically
-- identical — same function, same argument, same result — so no policy grants
-- or denies anything it did not before.
--
-- A useful side effect: multiple permissive policies on one table are combined
-- with OR, so an admin's now-constant `true` short-circuits the OTHER policy's
-- per-row EXISTS(...) subquery on survey_questions / survey_question_options /
-- survey_sections. That per-row join into `surveys` was the real cost on the
-- builder screens, and it disappears for admins without touching those
-- policies at all.
--
-- Driven off the catalogue rather than a hardcoded list of 43 statements: it
-- matches only policies whose predicate is EXACTLY the pure role check, so a
-- policy that also inspects row data is never rewritten by accident. Rewriting
-- changes the stored expression, so a second run matches nothing — idempotent.
-- =========================================================

DO $mig$
DECLARE
  p       record;
  target  text := 'has_role(auth.uid(), ''super_admin''::app_role)';
  wrapped text := '(SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role))';
  n       int  := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = target OR with_check = target)
  LOOP
    -- USING and WITH CHECK are altered independently: ALTER POLICY leaves the
    -- clause it is not given untouched, so an UPDATE policy carrying both keeps
    -- both, and an INSERT policy (WITH CHECK only) is not handed a USING it
    -- cannot have.
    IF p.qual = target THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
                     p.policyname, p.schemaname, p.tablename, wrapped);
    END IF;
    IF p.with_check = target THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
                     p.policyname, p.schemaname, p.tablename, wrapped);
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'hoisted % pure role-check policies', n;
END;
$mig$;

-- The three policies that mix the role check with row data, rewritten by hand
-- for the same reason. Predicates are unchanged apart from the hoist.
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='user_roles'
               AND policyname='Users view own roles') THEN
    ALTER POLICY "Users view own roles" ON public.user_roles
      USING (user_id = (SELECT auth.uid())
             OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='profiles'
               AND policyname='profiles_self_read') THEN
    ALTER POLICY profiles_self_read ON public.profiles
      USING (id = (SELECT auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='audit_logs'
               AND policyname='Any authenticated insert audit') THEN
    ALTER POLICY "Any authenticated insert audit" ON public.audit_logs
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END;
$mig$;

-- ---------------------------------------------------------
-- Covering indexes for the foreign keys the live app actually joins or
-- cascades on. An unindexed FK makes the referenced side's DELETE scan the
-- whole child table, and makes the reverse lookup a sequential scan.
-- Legacy prototype tables are left alone.
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_family_cases_response
  ON public.family_cases(response_id) WHERE response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_surveys_created_by
  ON public.surveys(created_by);

CREATE INDEX IF NOT EXISTS idx_survey_questions_source_ref
  ON public.survey_questions(source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qb_instruments_created_by
  ON public.question_bank_instruments(created_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs(user_id);

-- survey_answers is the widest table in the live model and is always read by
-- response; survey_responses is always listed newest-first per survey.
CREATE INDEX IF NOT EXISTS idx_survey_answers_response
  ON public.survey_answers(response_id);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_submitted
  ON public.survey_responses(survey_id, submitted_at DESC);


-- ####################################################################
-- 20260722164500_survey_list_counts.sql
-- ####################################################################
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


-- ####################################################################
-- 20260722180000_family_followups.sql
-- ####################################################################
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
    -- JIF- number an officer can read out, not a suffix of the parent's.
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

