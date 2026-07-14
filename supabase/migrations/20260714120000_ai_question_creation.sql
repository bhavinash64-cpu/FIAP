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
