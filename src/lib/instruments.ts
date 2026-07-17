import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import type { QuestionKind, SurveyQuestion, SurveyOption } from "@/lib/surveys";

// ---------------------------------------------------------------------------
// Question Library — the validated clinical/self-report instruments supplied
// as source PDFs, encoded as faithful survey questions.
//
// Each instrument item becomes a survey question. Scaled items (Likert-type)
// are modelled as `multiple_choice` whose OPTIONS are the instrument's own
// response anchors (e.g. IRI's 0–4 "Does not describe me well → Describes me
// very well"), so the response scale is reproduced exactly rather than forced
// into a generic agree/disagree scale. Option labels are bilingual; item
// prompts carry Telugu where a responsible translation is available and fall
// back to English otherwise (the "both" language mode shows English-only in
// that case rather than fabricating clinical Telugu).
// ---------------------------------------------------------------------------

export interface ScalePoint {
  en: string;
  te?: string;
}

export interface InstrumentItem {
  en: string;
  te?: string;
  /** Override the instrument's default kind/scale for this single item. */
  kind?: QuestionKind;
  scale?: ScalePoint[];
}

export interface Instrument {
  key: string;
  name: string;
  nameTe?: string;
  blurb: string;
  source: string;
  /** Default response scale applied to every item unless the item overrides it. */
  defaultScale?: ScalePoint[];
  defaultKind?: QuestionKind;
  items: InstrumentItem[];
}

// --- Shared response scales -------------------------------------------------

const YES_NO: ScalePoint[] = [
  { en: "No", te: "కాదు" },
  { en: "Yes", te: "అవును" },
];

const IRI_SCALE: ScalePoint[] = [
  { en: "0 — Does not describe me well", te: "0 — నన్ను సరిగ్గా వర్ణించదు" },
  { en: "1", te: "1" },
  { en: "2", te: "2" },
  { en: "3", te: "3" },
  { en: "4 — Describes me very well", te: "4 — నన్ను చాలా బాగా వర్ణిస్తుంది" },
];

const CIUS_SCALE: ScalePoint[] = [
  { en: "Never", te: "ఎప్పుడూ కాదు" },
  { en: "Seldom", te: "అరుదుగా" },
  { en: "Sometimes", te: "కొన్నిసార్లు" },
  { en: "Often", te: "తరచుగా" },
  { en: "Very often", te: "చాలా తరచుగా" },
];

const PID5_SCALE: ScalePoint[] = [
  { en: "Very false or often false", te: "పూర్తిగా అబద్ధం / తరచుగా అబద్ధం" },
  { en: "Sometimes or somewhat false", te: "కొన్నిసార్లు / కొంతవరకు అబద్ధం" },
  { en: "Sometimes or somewhat true", te: "కొన్నిసార్లు / కొంతవరకు నిజం" },
  { en: "Very true or often true", te: "పూర్తిగా నిజం / తరచుగా నిజం" },
];

const WHO5_SCALE: ScalePoint[] = [
  { en: "At no time", te: "ఎప్పుడూ లేదు" },
  { en: "Some of the time", te: "కొంత సమయం" },
  { en: "Less than half the time", te: "సగం కంటే తక్కువ సమయం" },
  { en: "More than half the time", te: "సగం కంటే ఎక్కువ సమయం" },
  { en: "Most of the time", te: "చాలా వరకు" },
  { en: "All of the time", te: "అన్ని వేళలా" },
];

const ANGER_SCALE: ScalePoint[] = [
  { en: "Almost never", te: "దాదాపు ఎప్పుడూ కాదు" },
  { en: "Sometimes", te: "కొన్నిసార్లు" },
  { en: "Often", te: "తరచుగా" },
  { en: "Almost always", te: "దాదాపు ఎల్లప్పుడూ" },
];

// --- Instruments ------------------------------------------------------------

const IRI: Instrument = {
  key: "iri",
  name: "Interpersonal Reactivity Index (IRI)",
  nameTe: "వ్యక్తుల మధ్య ప్రతిస్పందన సూచిక (IRI)",
  blurb: "28-item empathy measure — four subscales (perspective-taking, fantasy, empathic concern, personal distress).",
  source: "Davis, M. H. (1980).",
  defaultKind: "multiple_choice",
  defaultScale: IRI_SCALE,
  items: [
    { en: "I daydream and fantasize, with some regularity, about things that might happen to me." },
    { en: "I often have tender, concerned feelings for people less fortunate than me." },
    { en: "I sometimes find it difficult to see things from the other person's point of view." },
    { en: "Sometimes I don't feel very sorry for other people when they are having problems." },
    { en: "I really get involved with the feelings of the characters in a novel." },
    { en: "In emergency situations, I feel apprehensive and ill-at-ease." },
    { en: "I am usually objective when I watch a movie or play, and I don't often get completely caught up in it." },
    { en: "I try to look at everybody's side of a disagreement before I make a decision." },
    { en: "When I see someone being taken advantage of, I feel kind of protective towards them." },
    { en: "I sometimes feel helpless when I am in the middle of a very emotional situation." },
    { en: "I sometimes try to understand my friends better by imagining how things look from their perspective." },
    { en: "Becoming extremely involved in a good book or movie is somewhat rare for me." },
    { en: "When I see someone get hurt, I tend to remain calm." },
    { en: "Other people's misfortunes do not usually disturb me a great deal." },
    { en: "If I'm sure I'm right about something, I don't waste much time listening to other people's arguments." },
    { en: "After seeing a play or movie, I have felt as though I were one of the characters." },
    { en: "Being in a tense emotional situation scares me." },
    { en: "When I see someone being treated unfairly, I sometimes don't feel very much pity for them." },
    { en: "I am usually pretty effective in dealing with emergencies." },
    { en: "I am often quite touched by things that I see happen." },
    { en: "I believe that there are two sides to every question and try to look at them both." },
    { en: "I would describe myself as a pretty soft-hearted person." },
    { en: "When I watch a good movie, I can very easily put myself in the place of a leading character." },
    { en: "I tend to lose control during emergencies." },
    { en: "When I'm upset at someone, I usually try to put myself in their shoes for a while." },
    { en: "When I am reading an interesting story or novel, I imagine how I would feel if the events in the story were happening to me." },
    { en: "When I see someone who badly needs help in an emergency, I go to pieces." },
    { en: "Before criticizing somebody, I try to imagine how I would feel if I were in their place." },
  ],
};

const CIUS: Instrument = {
  key: "cius",
  name: "Compulsive Internet Use Scale (CIUS)",
  nameTe: "నిర్బంధ ఇంటర్నెట్ వినియోగ స్కేల్ (CIUS)",
  blurb: "14-item measure of problematic internet use for private purposes.",
  source: "Meerkerk, G.-J., et al. (2009).",
  defaultKind: "multiple_choice",
  defaultScale: CIUS_SCALE,
  items: [
    { en: "How often do you find it difficult to stop using the internet when you are online?", te: "మీరు ఆన్‌లైన్‌లో ఉన్నప్పుడు ఇంటర్నెట్ వాడకాన్ని ఆపడం ఎంత తరచుగా కష్టంగా అనిపిస్తుంది?" },
    { en: "How often do you continue to use the internet despite your intention to stop?", te: "ఆపాలనే ఉద్దేశం ఉన్నప్పటికీ మీరు ఎంత తరచుగా ఇంటర్నెట్ వాడకాన్ని కొనసాగిస్తారు?" },
    { en: "How often do others (e.g. partner, children, parents, friends) say you should use the internet less?", te: "మీరు ఇంటర్నెట్ తక్కువగా వాడాలని ఇతరులు (భాగస్వామి, పిల్లలు, తల్లిదండ్రులు, స్నేహితులు) ఎంత తరచుగా చెబుతారు?" },
    { en: "How often do you prefer to use the internet instead of spending time with others?", te: "ఇతరులతో సమయం గడపడం కంటే ఇంటర్నెట్ వాడటానికే మీరు ఎంత తరచుగా ఇష్టపడతారు?" },
    { en: "How often are you short of sleep because of the internet?", te: "ఇంటర్నెట్ కారణంగా మీకు ఎంత తరచుగా నిద్ర లేమి ఏర్పడుతుంది?" },
    { en: "How often do you think about the internet, even when not online?", te: "ఆన్‌లైన్‌లో లేనప్పుడు కూడా ఇంటర్నెట్ గురించి ఎంత తరచుగా ఆలోచిస్తారు?" },
    { en: "How often do you look forward to your next internet session?", te: "మీ తదుపరి ఇంటర్నెట్ సెషన్ కోసం ఎంత తరచుగా ఎదురుచూస్తారు?" },
    { en: "How often do you think you should use the internet less often?", te: "మీరు ఇంటర్నెట్ తక్కువగా వాడాలని ఎంత తరచుగా అనుకుంటారు?" },
    { en: "How often have you unsuccessfully tried to spend less time on the internet?", te: "ఇంటర్నెట్‌పై తక్కువ సమయం గడపడానికి ఎంత తరచుగా విఫల ప్రయత్నం చేశారు?" },
    { en: "How often do you rush through your (home) work in order to go on the internet?", te: "ఇంటర్నెట్‌కు వెళ్లడానికి మీ (ఇంటి) పనిని ఎంత తరచుగా తొందరగా ముగిస్తారు?" },
    { en: "How often do you neglect your daily obligations (work, school or family life) because you prefer to go on the internet?", te: "ఇంటర్నెట్‌కు వెళ్లడం ఇష్టపడటం వల్ల మీ దైనందిన బాధ్యతలను (పని, పాఠశాల, కుటుంబ జీవితం) ఎంత తరచుగా నిర్లక్ష్యం చేస్తారు?" },
    { en: "How often do you go on the internet when you are feeling down?", te: "మీరు నిరుత్సాహంగా ఉన్నప్పుడు ఎంత తరచుగా ఇంటర్నెట్‌కు వెళ్తారు?" },
    { en: "How often do you use the internet to escape from your sorrows or get relief from negative feelings?", te: "మీ దుఃఖాల నుండి తప్పించుకోవడానికి లేదా ప్రతికూల భావాల నుండి ఉపశమనం పొందడానికి ఎంత తరచుగా ఇంటర్నెట్ వాడతారు?" },
    { en: "How often do you feel restless, frustrated or irritated when you cannot use the internet?", te: "ఇంటర్నెట్ వాడలేనప్పుడు మీకు ఎంత తరచుగా అశాంతి, నిరాశ లేదా చిరాకు కలుగుతుంది?" },
  ],
};

const PID5BF: Instrument = {
  key: "pid5bf",
  name: "Personality Inventory for DSM-5 — Brief Form (PID-5-BF)",
  nameTe: "DSM-5 వ్యక్తిత్వ సూచిక — సంక్షిప్త రూపం (PID-5-BF)",
  blurb: "25-item screen across five personality trait domains (negative affect, detachment, antagonism, disinhibition, psychoticism).",
  source: "Krueger, R. F., et al. © 2013 American Psychiatric Association.",
  defaultKind: "multiple_choice",
  defaultScale: PID5_SCALE,
  items: [
    { en: "People would describe me as reckless." },
    { en: "I feel like I act totally on impulse." },
    { en: "Even though I know better, I can't stop making rash decisions." },
    { en: "I often feel like nothing I do really matters." },
    { en: "Others see me as irresponsible." },
    { en: "I'm not good at planning ahead." },
    { en: "My thoughts often don't make sense to others." },
    { en: "I worry about almost everything." },
    { en: "I get emotional easily, often for very little reason." },
    { en: "I fear being alone in life more than anything else." },
    { en: "I get stuck on one way of doing things, even when it's clear it won't work." },
    { en: "I have seen things that weren't really there." },
    { en: "I steer clear of romantic relationships." },
    { en: "I'm not interested in making friends." },
    { en: "I get irritated easily by all sorts of things." },
    { en: "I don't like to get too close to people." },
    { en: "It's no big deal if I hurt other people's feelings." },
    { en: "I rarely get enthusiastic about anything." },
    { en: "I crave attention." },
    { en: "I often have to deal with people who are less important than me." },
    { en: "I often have thoughts that make sense to me but that other people say are strange." },
    { en: "I use people to get what I want." },
    { en: "I often “zone out” and then suddenly come to and realize that a lot of time has passed." },
    { en: "Things around me often feel unreal, or more real than usual." },
    { en: "It is easy for me to take advantage of others." },
  ],
};

const WHO5: Instrument = {
  key: "who5",
  name: "WHO Well-Being Index (WHO-5)",
  nameTe: "WHO శ్రేయస్సు సూచిక (WHO-5)",
  blurb: "5-item well-being scale — how you have felt over the last two weeks (higher = better well-being).",
  source: "World Health Organization.",
  defaultKind: "multiple_choice",
  defaultScale: WHO5_SCALE,
  items: [
    { en: "I have felt cheerful and in good spirits.", te: "నేను ఉల్లాసంగా, మంచి మనోభావంతో ఉన్నాను." },
    { en: "I have felt calm and relaxed.", te: "నేను ప్రశాంతంగా, విశ్రాంతిగా ఉన్నాను." },
    { en: "I have felt active and vigorous.", te: "నేను చురుకుగా, ఉత్సాహంగా ఉన్నాను." },
    { en: "I have felt fresh and rested.", te: "నేను తాజాగా, విశ్రాంతి తీసుకున్నట్లు అనిపించింది." },
    { en: "My daily life has been filled with things that interest me.", te: "నా దైనందిన జీవితం నాకు ఆసక్తి కలిగించే విషయాలతో నిండి ఉంది." },
  ],
};

const TRAIT_ANGER: Instrument = {
  key: "trait_anger",
  name: "Trait Anger Scale",
  nameTe: "కోప స్వభావ స్కేల్",
  blurb: "10-item measure of how you generally feel in terms of anger.",
  source: "Spielberger (SUPRE-MISS).",
  defaultKind: "multiple_choice",
  defaultScale: ANGER_SCALE,
  items: [
    { en: "I have a fiery temper." },
    { en: "I am quick-tempered." },
    { en: "I am a hot-headed person." },
    { en: "It makes me furious when I am criticized in front of others." },
    { en: "I get angry when I'm slowed down by others' mistakes." },
    { en: "I feel infuriated when I do a good job and get a poor evaluation." },
    { en: "I fly off the handle." },
    { en: "I feel annoyed when I am not given recognition for doing good work." },
    { en: "When I get mad, I say nasty things." },
    { en: "When I get frustrated, I feel like hitting someone." },
  ],
};

const IMPULSIVENESS: Instrument = {
  key: "impulsiveness",
  name: "Impulsiveness Scale (optional)",
  nameTe: "ఆవేశ స్కేల్ (ఐచ్ఛికం)",
  blurb: "24-item yes/no impulsiveness measure.",
  source: "Eysenck & Eysenck, 1978 (SUPRE-MISS Annex 5).",
  defaultKind: "yes_no",
  items: [
    { en: "Do you often long for excitement?" },
    { en: "Do you feel at your best after taking a couple of drinks?" },
    { en: "Do you save regularly?" },
    { en: "Do you often buy things on impulse?" },
    { en: "Do you generally do and say things without stopping to think?" },
    { en: "Do you prefer quiet parties with good conversations to “wild” uninhibited ones?" },
    { en: "Do you often get into a jam because you do things without thinking?" },
    { en: "Would you often like to get high (drinking liquor or smoking)?" },
    { en: "Are you an impulsive person?" },
    { en: "Do you usually think carefully before doing anything?" },
    { en: "Do you often do things on the spur of the moment?" },
    { en: "Do you often enjoy breaking rules you consider unreasonable?" },
    { en: "Are you rather cautious in unusual situations?" },
    { en: "Do you mostly speak before thinking things out?" },
    { en: "Do you often get involved in things you later wish you could get out of?" },
    { en: "Do you get so carried away by new and exciting ideas that you never think of possible snags?" },
    { en: "Do you get bored more easily than most people doing the same old things?" },
    { en: "Would you agree that planning things ahead takes the fun out of life?" },
    { en: "Do you need to use a lot of self-control to keep out of trouble?" },
    { en: "Would you agree that almost everything enjoyable is illegal or immoral?" },
    { en: "Are you often surprised at people's reactions to what you do or say?" },
    { en: "Do you get extremely impatient if you are kept waiting by someone who is late?" },
    { en: "Do you think an evening out is more successful if it is unplanned or arranged at the last moment?" },
    { en: "Do you get very restless if you have to stay around home for any length of time?" },
  ],
};

const HOPELESSNESS: Instrument = {
  key: "hopelessness",
  name: "Hopelessness (single item)",
  nameTe: "నిరాశ (ఒకే ప్రశ్న)",
  blurb: "Single true/false item on outlook for the future.",
  source: "SUPRE-MISS §11.",
  defaultKind: "multiple_choice",
  defaultScale: [
    { en: "False", te: "అబద్ధం" },
    { en: "True", te: "నిజం" },
  ],
  items: [{ en: "My future seems dark to me.", te: "నా భవిష్యత్తు నాకు చీకటిగా కనిపిస్తోంది." }],
};

// Beck Depression Inventory — each item is a group of statements (0–3),
// so every item carries its own option set instead of a shared scale.
const BDI: Instrument = {
  key: "bdi",
  name: "Beck Depression Inventory (BDI)",
  nameTe: "బెక్ డిప్రెషన్ ఇన్వెంటరీ (BDI)",
  blurb: "21 grouped statements — pick the one that best represents how you feel right now.",
  source: "Beck (SUPRE-MISS §10).",
  defaultKind: "multiple_choice",
  items: [
    { en: "Sadness", scale: [{ en: "I do not feel sad." }, { en: "I feel sad." }, { en: "I am sad all the time and I can't snap out of it." }, { en: "I am so sad or unhappy that I can't stand it." }] },
    { en: "Pessimism", scale: [{ en: "I am not particularly discouraged about the future." }, { en: "I feel discouraged about the future." }, { en: "I feel I have nothing to look forward to." }, { en: "I feel the future is hopeless and that things cannot improve." }] },
    { en: "Sense of failure", scale: [{ en: "I do not feel like a failure." }, { en: "I feel I have failed more than the average person." }, { en: "As I look back on my life, all I can see is a lot of failures." }, { en: "I feel I am a complete failure as a person." }] },
    { en: "Loss of satisfaction", scale: [{ en: "I get as much satisfaction out of things as I used to." }, { en: "I don't enjoy things the way I used to." }, { en: "I don't get real satisfaction out of anything anymore." }, { en: "I am dissatisfied or bored with everything." }] },
    { en: "Guilt", scale: [{ en: "I don't feel particularly guilty." }, { en: "I feel guilty a good part of the time." }, { en: "I feel quite guilty most of the time." }, { en: "I feel guilty all of the time." }] },
    { en: "Punishment", scale: [{ en: "I don't feel I am being punished." }, { en: "I feel I may be punished." }, { en: "I expect to be punished." }, { en: "I feel I am being punished." }] },
    { en: "Self-dislike", scale: [{ en: "I don't feel disappointed in myself." }, { en: "I am disappointed in myself." }, { en: "I am disgusted with myself." }, { en: "I hate myself." }] },
    { en: "Self-criticism", scale: [{ en: "I don't feel I am any worse than anybody else." }, { en: "I am critical of myself for my weaknesses or mistakes." }, { en: "I blame myself all the time for my faults." }, { en: "I blame myself for everything bad that happens." }] },
    { en: "Suicidal thoughts", scale: [{ en: "I don't have any thoughts of killing myself." }, { en: "I have thoughts of killing myself, but I would not carry them out." }, { en: "I would like to kill myself." }, { en: "I would kill myself if I had the chance." }] },
    { en: "Crying", scale: [{ en: "I don't cry any more than usual." }, { en: "I cry more now than I used to." }, { en: "I cry all the time now." }, { en: "I used to be able to cry, but now I can't cry even though I want to." }] },
    { en: "Irritability", scale: [{ en: "I am no more irritated now than I ever am." }, { en: "I get annoyed or irritated more easily than I used to." }, { en: "I feel irritated all the time now." }, { en: "I don't get irritated at all by the things that used to irritate me." }] },
    { en: "Loss of interest", scale: [{ en: "I have not lost interest in other people." }, { en: "I am less interested in other people than I used to be." }, { en: "I have lost most of my interest in other people." }, { en: "I have lost all of my interest in other people." }] },
    { en: "Indecisiveness", scale: [{ en: "I make decisions about as well as I ever did." }, { en: "I put off making decisions more than I used to." }, { en: "I have greater difficulty in making decisions than before." }, { en: "I can't make decisions at all anymore." }] },
    { en: "Worthlessness (appearance)", scale: [{ en: "I don't feel I look any worse than I used to." }, { en: "I am worried that I am looking old or unattractive." }, { en: "I feel there are permanent changes in my appearance that make me look unattractive." }, { en: "I believe that I look ugly." }] },
    { en: "Loss of energy (work)", scale: [{ en: "I can work about as well as before." }, { en: "It takes an extra effort to get started at doing something." }, { en: "I have to push myself very hard to do anything." }, { en: "I can't do any work at all." }] },
    { en: "Sleep", scale: [{ en: "I can sleep as well as usual." }, { en: "I don't sleep as well as I used to." }, { en: "I wake up 1–2 hours earlier than usual and find it hard to get back to sleep." }, { en: "I wake up several hours earlier than I used to and cannot get back to sleep." }] },
    { en: "Tiredness", scale: [{ en: "I don't get more tired than usual." }, { en: "I get tired more easily than I used to." }, { en: "I get tired from doing almost anything." }, { en: "I am too tired to do anything." }] },
    { en: "Appetite", scale: [{ en: "My appetite is no worse than usual." }, { en: "My appetite is not as good as it used to be." }, { en: "My appetite is much worse now." }, { en: "I have no appetite at all anymore." }] },
    { en: "Weight loss", scale: [{ en: "I haven't lost much weight, if any, lately." }, { en: "I have lost more than 5 pounds." }, { en: "I have lost more than 10 pounds." }, { en: "I have lost more than 15 pounds." }] },
    { en: "Health worry", scale: [{ en: "I am no more worried about my health than usual." }, { en: "I am worried about physical problems such as aches and pains, or upset stomach, or constipation." }, { en: "I am very worried about physical problems, and it's hard to think of much else." }, { en: "I am so worried about my physical problems that I cannot think about anything else." }] },
    { en: "Loss of interest in sex", scale: [{ en: "I have not noticed any recent change in my interest in sex." }, { en: "I am less interested in sex than I used to be." }, { en: "I am much less interested in sex now." }, { en: "I have lost interest in sex completely." }] },
  ],
};

export const INSTRUMENTS: Instrument[] = [
  IRI,
  CIUS,
  PID5BF,
  WHO5,
  TRAIT_ANGER,
  IMPULSIVENESS,
  HOPELESSNESS,
  BDI,
];

export function instrumentQuestionCount(inst: Instrument): number {
  return inst.items.length;
}

// ---------------------------------------------------------------------------
// Import — inserts an instrument's items (with bilingual options) as questions
// on a survey, appended after the current last question. Reuses the
// import_batches provenance trail (source_type 'pdf', since these originate
// from the supplied source PDFs).
// ---------------------------------------------------------------------------

export async function importInstruments(surveyId: string, keys: string[]): Promise<SurveyQuestion[]> {
  const chosen = INSTRUMENTS.filter((i) => keys.includes(i.key));
  if (!chosen.length) return [];

  const totalCount = chosen.reduce((n, i) => n + i.items.length, 0);
  const { data: user } = await supabase.auth.getUser();
  const { data: batch, error: bErr } = await supabase
    .from("import_batches")
    .insert({
      survey_id: surveyId,
      source_type: "pdf",
      file_name: chosen.map((i) => i.name).join(", "),
      question_count: totalCount,
      created_by: user.user?.id,
    })
    .select("id")
    .single();
  if (bErr) throw bErr;

  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: false })
    .limit(1);
  let nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;

  const created: SurveyQuestion[] = [];

  for (const inst of chosen) {
    for (const item of inst.items) {
      const kind: QuestionKind = item.kind ?? inst.defaultKind ?? "multiple_choice";
      const scale = item.scale ?? inst.defaultScale;

      const { data: q, error: qErr } = await supabase
        .from("survey_questions")
        .insert({
          survey_id: surveyId,
          kind,
          order_index: nextIndex++,
          prompt_en: item.en,
          prompt_te: item.te ?? null,
          required: true,
          origin: "pdf",
          source_ref: batch.id,
        })
        .select("*")
        .single();
      if (qErr) throw qErr;

      let options: SurveyOption[] = [];
      const needsOptions = kind === "multiple_choice" || kind === "checkboxes" || kind === "dropdown";
      if (needsOptions && scale && scale.length) {
        const { data: opts, error: oErr } = await supabase
          .from("survey_question_options")
          .insert(scale.map((p, i) => ({ question_id: q.id, order_index: i, label_en: p.en, label_te: p.te ?? null })))
          .select("*");
        if (oErr) throw oErr;
        options = (opts ?? []) as SurveyOption[];
      }
      created.push({ ...(q as Omit<SurveyQuestion, "options">), options });
    }
  }

  await logAudit("question.import.library", "survey", surveyId, {
    instruments: chosen.map((i) => i.key),
    count: created.length,
  });
  return created;
}
