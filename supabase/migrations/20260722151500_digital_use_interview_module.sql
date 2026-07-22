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
