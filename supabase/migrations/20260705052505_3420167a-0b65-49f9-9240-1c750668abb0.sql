
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
