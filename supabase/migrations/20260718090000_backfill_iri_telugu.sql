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
