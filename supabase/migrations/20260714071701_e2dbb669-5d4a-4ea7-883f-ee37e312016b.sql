
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
