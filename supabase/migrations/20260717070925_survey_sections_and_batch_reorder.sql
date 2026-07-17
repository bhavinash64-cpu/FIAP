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
