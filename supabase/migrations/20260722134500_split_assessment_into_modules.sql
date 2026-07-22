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
