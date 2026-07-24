import { create } from "zustand";
import { useCallback, useEffect } from "react";

export type Lang = "en" | "te";
/**
 * Display mode chosen from the language toggle. Two modes only — the entire
 * interface and all content render fully in one language at a time.
 *  - "te" → Telugu (falls back to English only where a Telugu string is absent)
 *  - "en" → English
 */
export type LangMode = "te" | "en";

type Dict = Record<string, { en: string; te: string }>;

// The complete UI-string dictionary. Every piece of interface chrome — the
// parent assessment flow, the admin shell, settings, share tools — resolves
// through here so the language toggle switches the ENTIRE experience at once,
// never a mixed page. Authored survey content (titles, prompts, options)
// resolves through renderBilingual() instead.
export const dict = {
  appName: { en: "PsyDigiHealth", te: "సైడిజిహెల్త్" },
  appShort: { en: "PsyDigiHealth", te: "సైడిజిహెల్త్" },
  /** The institutional line under the product name. Deliberately organisation-
   *  neutral: this platform is not tied to any department or jurisdiction. */
  orgLine: { en: "Family Assessment Research Platform", te: "కుటుంబ మూల్యాంకన పరిశోధన వేదిక" },
  signIn: { en: "Sign in", te: "సైన్ ఇన్" },
  signOut: { en: "Sign out", te: "సైన్ అవుట్" },
  email: { en: "Email", te: "ఇమెయిల్" },
  password: { en: "Password", te: "పాస్‌వర్డ్" },
  dashboard: { en: "Dashboard", te: "డాష్‌బోర్డ్" },
  surveys: { en: "Surveys", te: "సర్వేలు" },
  analytics: { en: "Analytics", te: "విశ్లేషణలు" },
  reports: { en: "Reports", te: "నివేదికలు" },
  auditLog: { en: "Audit log", te: "ఆడిట్ లాగ్" },

  // ── Sidebar navigation — switches fully with the language toggle ─────────
  navOverview: { en: "Dashboard", te: "డాష్‌బోర్డ్" },
  navSurveys: { en: "Surveys", te: "సర్వేలు" },
  navQuestionBank: { en: "Question Library", te: "ప్రశ్న గ్రంథాలయం" },
  navMasters: { en: "Masters", te: "మాస్టర్స్" },
  navTemplates: { en: "Survey Templates", te: "సర్వే టెంప్లేట్లు" },
  navQr: { en: "QR & Links", te: "QR & లింకులు" },
  navFamilies: { en: "Families", te: "కుటుంబాలు" },
  navInvitations: { en: "Invitations", te: "ఆహ్వానాలు" },
  navResponses: { en: "Responses", te: "స్పందనలు" },
  navAnalytics: { en: "Analytics", te: "విశ్లేషణలు" },
  navReports: { en: "Reports", te: "నివేదికలు" },
  navExport: { en: "Export Center", te: "ఎగుమతి కేంద్రం" },
  navNotifications: { en: "Notifications", te: "నోటిఫికేషన్లు" },
  navAudit: { en: "Audit Logs", te: "ఆడిట్ లాగ్‌లు" },
  navSettings: { en: "Settings", te: "సెట్టింగ్‌లు" },
  navHelp: { en: "Help", te: "సహాయం" },
  navMore: { en: "More", te: "మరిన్ని" },
  navMoreTitle: { en: "More", te: "మరిన్ని" },
  navGroupWorkspace: { en: "Workspace", te: "వర్క్‌స్పేస్" },
  navGroupSurveys: { en: "Surveys", te: "సర్వేలు" },
  navGroupField: { en: "Families & Field", te: "కుటుంబాలు & క్షేత్రం" },
  navGroupInsights: { en: "Insights", te: "అంతర్దృష్టులు" },
  navGroupSystem: { en: "System", te: "సిస్టమ్" },
  navGroupPlatform: { en: "Platform", te: "ప్లాట్‌ఫారమ్" },

  // ── Common actions ───────────────────────────────────────────────────────
  language: { en: "Language", te: "భాష" },
  english: { en: "English", te: "ఇంగ్లీష్" },
  telugu: { en: "Telugu", te: "తెలుగు" },
  continue: { en: "Continue", te: "కొనసాగించండి" },
  back: { en: "Back", te: "వెనుకకు" },
  previous: { en: "Previous", te: "మునుపటిది" },
  next: { en: "Next", te: "తర్వాత" },
  save: { en: "Save", te: "సేవ్ చేయండి" },
  submit: { en: "Submit", te: "సమర్పించండి" },
  cancel: { en: "Cancel", te: "రద్దు" },
  close: { en: "Close", te: "మూసివేయండి" },
  saving: { en: "Saving…", te: "సేవ్ అవుతోంది…" },
  saved: { en: "Saved", te: "సేవ్ అయింది" },
  edit: { en: "Edit", te: "మార్చండి" },
  download: { en: "Download", te: "డౌన్‌లోడ్" },
  print: { en: "Print", te: "ప్రింట్" },
  copyLink: { en: "Copy link", te: "లింక్ కాపీ చేయండి" },
  copied: { en: "Copied", te: "కాపీ అయింది" },
  open: { en: "Open", te: "తెరవండి" },
  search: { en: "Search", te: "వెతకండి" },
  refresh: { en: "Refresh", te: "రిఫ్రెష్" },
  question: { en: "Question", te: "ప్రశ్న" },
  of: { en: "of", te: "లో" },
  answered: { en: "answered", te: "సమాధానమిచ్చారు" },
  requiredAnswer: { en: "Please choose an answer before continuing", te: "కొనసాగే ముందు దయచేసి ఒక సమాధానం ఎంచుకోండి" },
  yourAnswer: { en: "Your answer…", te: "మీ సమాధానం…" },
  selectOption: { en: "Select an option", te: "ఎంపికను ఎంచుకోండి" },
  yes: { en: "Yes", te: "అవును" },
  no: { en: "No", te: "కాదు" },
  loading: { en: "Loading…", te: "లోడ్ అవుతోంది…" },
  noQuestionsYet: { en: "This survey doesn't have any questions yet.", te: "ఈ సర్వేలో ఇంకా ప్రశ్నలు లేవు." },
  optional: { en: "Optional", te: "ఐచ్ఛికం" },
  required: { en: "Required", te: "తప్పనిసరి" },

  // ── Parent flow · shared chrome ──────────────────────────────────────────
  confidentialNoLogin: { en: "Confidential · secure access", te: "గోప్యం · సురక్షిత ప్రవేశం" },
  progressSaved: { en: "Your progress is saved automatically", te: "మీ పురోగతి ఆటోమేటిక్‌గా సేవ్ అవుతుంది" },
  questionXofY: { en: "Question {i} of {n}", te: "ప్రశ్న {i} / {n}" },
  aboutMinutesRemaining: { en: "About {n} minutes remaining", te: "సుమారు {n} నిమిషాలు మిగిలి ఉన్నాయి" },
  aboutOneMinuteRemaining: { en: "About a minute remaining", te: "సుమారు ఒక నిమిషం మిగిలి ఉంది" },
  lessThanMinuteRemaining: { en: "Less than a minute remaining", te: "ఒక నిమిషం కంటే తక్కువ మిగిలి ఉంది" },
  aboutMinutes: { en: "About {n} minutes", te: "సుమారు {n} నిమిషాలు" },
  nQuestions: { en: "{n} questions", te: "{n} ప్రశ్నలు" },
  percentComplete: { en: "{n}% complete", te: "{n}% పూర్తయింది" },

  // ── Parent flow · encouragement ──────────────────────────────────────────
  // Two moments only, across a run capped at 25 questions. Five would be one
  // message every four screens, which is the tiring, patronising failure this
  // is meant to avoid. Adult in register: acknowledgement, never praise.
  encourageHalfway: { en: "Halfway there.", te: "సగం పూర్తయింది." },
  encourageNearlyDone: { en: "Almost finished.", te: "దాదాపు పూర్తయింది." },

  // ── Parent flow · welcome ────────────────────────────────────────────────
  welcomeEyebrow: { en: "A well-being conversation", te: "శ్రేయస్సు సంభాషణ" },
  welcomeIntro: { en: "This is a gentle set of questions about how you and your family are doing. Please take your time — there are no right or wrong answers.", te: "ఇవి మీరు మరియు మీ కుటుంబం ఎలా ఉన్నారో తెలుసుకునే సున్నితమైన ప్రశ్నలు. దయచేసి మీ సమయం తీసుకోండి — సరైన లేదా తప్పు సమాధానాలు అంటూ ఏమీ లేవు." },
  estimatedTime: { en: "Estimated time", te: "అంచనా సమయం" },
  privacyTitle: { en: "Your privacy", te: "మీ గోప్యత" },
  privacyBody: { en: "Your answers are confidential and are used only to understand and support family well-being. Only the research team can see them.", te: "మీ సమాధానాలు గోప్యంగా ఉంచబడతాయి; కుటుంబ శ్రేయస్సును అర్థం చేసుకోవడానికి, తోడ్పడటానికి మాత్రమే వినియోగించబడతాయి. పరిశోధన బృందం మాత్రమే వాటిని చూడగలదు." },
  supportTitle: { en: "We are with you", te: "మేము మీతో ఉన్నాము" },
  supportBody: { en: "Answer at your own pace. You can pause at any time — every answer is saved the moment you give it.", te: "మీ సొంత వేగంతో సమాధానం ఇవ్వండి. మీరు ఎప్పుడైనా విరామం తీసుకోవచ్చు — మీరు ఇచ్చిన ప్రతి సమాధానం వెంటనే సేవ్ అవుతుంది." },
  beginAssessment: { en: "Begin", te: "ప్రారంభించండి" },
  welcomeBack: { en: "Welcome back", te: "తిరిగి స్వాగతం" },
  resumeBody: { en: "Your earlier answers are saved. You can continue from where you left off.", te: "మీ మునుపటి సమాధానాలు సేవ్ అయి ఉన్నాయి. మీరు ఆపిన చోటు నుండి కొనసాగవచ్చు." },
  continueAssessment: { en: "Continue where I left off", te: "నేను ఆపిన చోటు నుండి కొనసాగించండి" },
  startOver: { en: "Start over", te: "మొదటి నుండి ప్రారంభించండి" },

  // ── Parent flow · consent ────────────────────────────────────────────────
  consentTitle: { en: "Before we begin", te: "మేము ప్రారంభించే ముందు" },
  consentIntro: { en: "Please read these points. They explain how your answers are used.", te: "దయచేసి ఈ అంశాలను చదవండి. మీ సమాధానాలు ఎలా వినియోగించబడతాయో ఇవి వివరిస్తాయి." },
  consentVoluntary: { en: "Taking part is completely voluntary. You may stop at any time.", te: "పాల్గొనడం పూర్తిగా స్వచ్ఛందం. మీరు ఎప్పుడైనా ఆపివేయవచ్చు." },
  consentConfidential: { en: "Your answers are confidential and stored securely.", te: "మీ సమాధానాలు గోప్యంగా, సురక్షితంగా భద్రపరచబడతాయి." },
  consentResearch: { en: "Answers are used only for well-being research and support programmes.", te: "సమాధానాలు శ్రేయస్సు పరిశోధన మరియు సహాయ కార్యక్రమాల కోసం మాత్రమే వినియోగించబడతాయి." },
  consentNoJudgement: { en: "There are no right or wrong answers. Nothing you say will be judged.", te: "సరైన లేదా తప్పు సమాధానాలు లేవు. మీరు చెప్పే ఏ విషయం పైనా తీర్పు ఉండదు." },
  consentAgree: { en: "I understand, and I agree to take part", te: "నేను అర్థం చేసుకున్నాను, పాల్గొనడానికి అంగీకరిస్తున్నాను" },

  // ── Parent flow · instructions ───────────────────────────────────────────
  instructionsTitle: { en: "How this works", te: "ఇది ఎలా జరుగుతుంది" },
  instructionOneAtATime: { en: "You will see one question at a time, in large clear text.", te: "మీకు ఒక్కోసారి ఒక్క ప్రశ్న మాత్రమే, పెద్ద స్పష్టమైన అక్షరాలలో కనిపిస్తుంది." },
  instructionListen: { en: "Tap the Listen button to hear any question read aloud.", te: "ఏ ప్రశ్ననైనా వినడానికి “వినండి” బటన్‌ను నొక్కండి." },
  instructionAutoSave: { en: "Every answer is saved automatically. You can close and come back later.", te: "ప్రతి సమాధానం ఆటోమేటిక్‌గా సేవ్ అవుతుంది. మీరు మూసివేసి, తర్వాత తిరిగి రావచ్చు." },
  instructionGoBack: { en: "You can go back and change any answer before submitting.", te: "సమర్పించే ముందు మీరు వెనక్కి వెళ్లి ఏ సమాధానాన్నైనా మార్చవచ్చు." },
  startQuestions: { en: "Start the questions", te: "ప్రశ్నలు ప్రారంభించండి" },

  // ── Parent flow · question screen ────────────────────────────────────────
  listen: { en: "Listen", te: "వినండి" },
  pause: { en: "Pause", te: "పాజ్" },
  resume: { en: "Resume", te: "కొనసాగించండి" },
  replay: { en: "Replay", te: "మళ్లీ వినండి" },
  speed: { en: "Speed", te: "వేగం" },
  voiceUnavailable: { en: "Voice narration isn't supported in this browser.", te: "ఈ బ్రౌజర్‌లో వాయిస్ చదవడం మద్దతు లేదు." },
  voiceLangHint: { en: "For the clearest Telugu voice, install a Telugu text-to-speech voice in your device settings.", te: "స్పష్టమైన తెలుగు వాయిస్ కోసం, మీ పరికర సెట్టింగ్‌లలో తెలుగు టెక్స్ట్-టు-స్పీచ్ వాయిస్‌ను ఇన్‌స్టాల్ చేయండి." },
  skipQuestion: { en: "Skip for now", te: "ప్రస్తుతానికి దాటవేయండి" },
  ratingLabel: { en: "Rating", te: "రేటింగ్" },
  starOfFive: { en: "{n} of 5", te: "5లో {n}" },
  languageGroup: { en: "Language", te: "భాష" },
  goToReview: { en: "Review answers", te: "సమాధానాలు సమీక్షించండి" },
  charactersLeft: { en: "{n} characters left", te: "{n} అక్షరాలు మిగిలి ఉన్నాయి" },

  // ── Parent flow · review ─────────────────────────────────────────────────
  reviewTitle: { en: "Review your answers", te: "మీ సమాధానాలను సమీక్షించండి" },
  reviewIntro: { en: "You can change any answer before submitting.", te: "సమర్పించే ముందు మీరు ఏ సమాధానాన్నైనా మార్చవచ్చు." },
  answeredCount: { en: "Answered", te: "సమాధానమిచ్చినవి" },
  remainingCount: { en: "Remaining", te: "మిగిలినవి" },
  notAnswered: { en: "Not answered", te: "సమాధానం ఇవ్వలేదు" },
  answerRemainingNote: { en: "{n} questions still need an answer.", te: "{n} ప్రశ్నలకు ఇంకా సమాధానం ఇవ్వాలి." },
  allAnswered: { en: "All questions are answered.", te: "అన్ని ప్రశ్నలకు సమాధానం ఇచ్చారు." },
  submitAnswers: { en: "Submit my answers", te: "నా సమాధానాలు సమర్పించండి" },
  submitting: { en: "Submitting…", te: "సమర్పించబడుతోంది…" },

  // ── Parent flow · thank you ──────────────────────────────────────────────
  thankYou: { en: "Thank you", te: "ధన్యవాదాలు" },
  thankYouBody: { en: "Your answers have been received safely. Your time and openness mean a great deal.", te: "మీ సమాధానాలు సురక్షితంగా అందాయి. మీ సమయం, నిజాయితీ ఎంతో విలువైనవి." },
  referenceId: { en: "Reference ID", te: "సూచన సంఖ్య" },
  submittedOn: { en: "Submitted on", te: "సమర్పించిన తేదీ" },
  downloadAcknowledgement: { en: "Download acknowledgement", te: "ధృవీకరణ డౌన్‌లోడ్ చేయండి" },
  closingNote: { en: "You may now close this page.", te: "మీరు ఇప్పుడు ఈ పేజీని మూసివేయవచ్చు." },

  // ── Parent flow · status screens ─────────────────────────────────────────
  surveyNotFoundTitle: { en: "Survey not found", te: "సర్వే కనబడలేదు" },
  surveyNotFoundBody: { en: "This link doesn't match any survey. Please check the link and try again.", te: "ఈ లింక్ ఏ సర్వేకూ సరిపోలడం లేదు. దయచేసి లింక్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి." },
  surveyClosedTitle: { en: "This survey is closed", te: "ఈ సర్వే ముగిసింది" },
  surveyClosedBody: { en: "“{title}” is no longer accepting responses. Thank you for your interest.", te: "“{title}” ఇప్పుడు స్పందనలను స్వీకరించడం లేదు. మీ ఆసక్తికి ధన్యవాదాలు." },
  somethingWrongTitle: { en: "Something went wrong", te: "ఏదో పొరపాటు జరిగింది" },
  somethingWrongBody: { en: "Please check your connection and reload this page.", te: "దయచేసి మీ కనెక్షన్‌ను సరిచూసి ఈ పేజీని రీలోడ్ చేయండి." },
  submitFailed: { en: "Couldn't submit right now. Please check your connection and try again.", te: "ప్రస్తుతం సమర్పించలేకపోయాము. దయచేసి మీ కనెక్షన్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి." },

  // ── Family access · sign in ──────────────────────────────────────────────
  familySignInTitle: { en: "Family Assessment", te: "కుటుంబ మూల్యాంకనం" },
  familySignInIntro: { en: "Enter the phone number and PIN given to you by your field officer.", te: "మీ క్షేత్ర అధికారి ఇచ్చిన ఫోన్ నంబర్, పిన్‌ను నమోదు చేయండి." },
  familyPhoneLabel: { en: "Phone number", te: "ఫోన్ నంబర్" },
  familyPhoneHelp: { en: "The 10-digit mobile number recorded for your family", te: "మీ కుటుంబానికి నమోదు చేసిన 10 అంకెల మొబైల్ నంబర్" },
  familyPinLabel: { en: "Temporary PIN", te: "తాత్కాలిక పిన్" },
  familyPinHelp: { en: "The 6-digit PIN on your assessment slip", te: "మీ మూల్యాంకన స్లిప్‌పై ఉన్న 6 అంకెల పిన్" },
  familyContinue: { en: "Continue", te: "కొనసాగించండి" },
  familyCheckingIn: { en: "Checking…", te: "తనిఖీ చేస్తోంది…" },
  familyForCase: { en: "Assessment for {name}", te: "{name} కోసం మూల్యాంకనం" },
  familyPhoneEndingIn: { en: "Registered number ending {hint}", te: "నమోదైన నంబర్ చివర {hint}" },
  familyNeedHelp: { en: "Lost your PIN? Please contact the officer who visited your family.", te: "మీ పిన్ పోయిందా? మీ కుటుంబాన్ని సందర్శించిన అధికారిని సంప్రదించండి." },

  // ── Family access · errors ───────────────────────────────────────────────
  familyErrInvalid: { en: "That phone number and PIN don't match. Please check your slip and try again.", te: "ఆ ఫోన్ నంబర్, పిన్ సరిపోలడం లేదు. దయచేసి మీ స్లిప్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి." },
  familyErrLocked: { en: "Too many incorrect attempts. Please wait 15 minutes and try again.", te: "చాలాసార్లు తప్పు ప్రయత్నాలు జరిగాయి. దయచేసి 15 నిమిషాలు ఆగి మళ్లీ ప్రయత్నించండి." },
  familyErrExpired: { en: "This assessment link has expired. Please contact your field officer for a new one.", te: "ఈ మూల్యాంకన లింక్ గడువు ముగిసింది. కొత్తదాని కోసం మీ క్షేత్ర అధికారిని సంప్రదించండి." },
  familyErrTooMany: { en: "Too many attempts from this connection. Please try again a little later.", te: "ఈ కనెక్షన్ నుండి చాలా ప్రయత్నాలు జరిగాయి. దయచేసి కొంతసేపటి తర్వాత ప్రయత్నించండి." },
  familyErrNetwork: { en: "Couldn't reach the assessment. Please check your connection and try again.", te: "మూల్యాంకనాన్ని చేరుకోలేకపోయాము. దయచేసి మీ కనెక్షన్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి." },
  familyErrLockedRetry: { en: "You can try again in {n} minutes.", te: "{n} నిమిషాల్లో మళ్లీ ప్రయత్నించవచ్చు." },
  familyErrAlreadyDone: { en: "This assessment has already been completed. Thank you.", te: "ఈ మూల్యాంకనం ఇప్పటికే పూర్తయింది. ధన్యవాదాలు." },
  familyErrNotYetOpen: { en: "This assessment has not opened yet. Please come back on the date shown on your slip.", te: "ఈ మూల్యాంకనం ఇంకా ప్రారంభం కాలేదు. మీ స్లిప్‌లో ఉన్న తేదీన మళ్లీ రండి." },
  familyNeedLinkTitle: { en: "Open your assessment link", te: "మీ మూల్యాంకన లింక్‌ను తెరవండి" },
  familyNeedLinkBody: {
    en: "Scan the QR code on your assessment slip, or open the link your field officer gave you. You will then be asked for your phone number.",
    te: "మీ మూల్యాంకన స్లిప్‌పై ఉన్న QR కోడ్‌ను స్కాన్ చేయండి, లేదా మీ క్షేత్ర అధికారి ఇచ్చిన లింక్‌ను తెరవండి. తర్వాత మీ ఫోన్ నంబర్ అడగబడుతుంది.",
  },
  familyErrNotFound: { en: "This link is not valid", te: "ఈ లింక్ చెల్లదు" },
  familyErrNotFoundBody: { en: "Please check the link on your assessment slip, or scan the QR code again.", te: "మీ మూల్యాంకన స్లిప్‌పై ఉన్న లింక్‌ను సరిచూడండి, లేదా QR కోడ్‌ను మళ్లీ స్కాన్ చేయండి." },
  familySessionEnded: { en: "Your session has ended. Please sign in again to continue.", te: "మీ సెషన్ ముగిసింది. కొనసాగడానికి మళ్లీ సైన్ ఇన్ చేయండి." },
  familyNotYourPage: { en: "This page isn't part of your assessment.", te: "ఈ పేజీ మీ మూల్యాంకనంలో భాగం కాదు." },

  // ── Family access · session ──────────────────────────────────────────────
  familyExitTitle: { en: "Leave the assessment?", te: "మూల్యాంకనాన్ని వదిలివేయాలా?" },
  familyExitBody: { en: "Your answers are saved. You can sign in again with the same phone number and PIN to continue.", te: "మీ సమాధానాలు సేవ్ అయ్యాయి. అదే ఫోన్ నంబర్, పిన్‌తో మళ్లీ సైన్ ఇన్ చేసి కొనసాగవచ్చు." },
  familyExitConfirm: { en: "Leave for now", te: "ప్రస్తుతానికి వదిలివేయండి" },
  familyExit: { en: "Leave", te: "వదిలివేయండి" },
  familySavedToAccount: { en: "Saved", te: "సేవ్ అయింది" },
  familySavingOffline: { en: "Saved on this device", te: "ఈ పరికరంలో సేవ్ అయింది" },
  familyOfflineNote: { en: "You are offline. Your answers are safe and will sync when you reconnect.", te: "మీరు ఆఫ్‌లైన్‌లో ఉన్నారు. మీ సమాధానాలు సురక్షితం; కనెక్ట్ అయ్యాక సింక్ అవుతాయి." },
  assessmentIdLabel: { en: "Assessment ID", te: "మూల్యాంకన ఐడీ" },

  // ── Secure access notice (retired public links) ──────────────────────────
  secureAccessTitle: { en: "Secure access required", te: "సురక్షిత ప్రవేశం అవసరం" },
  secureAccessBody: { en: "Assessments are now opened with the personal link and PIN given to your family by a field officer.", te: "మూల్యాంకనాలు ఇప్పుడు క్షేత్ర అధికారి మీ కుటుంబానికి ఇచ్చిన వ్యక్తిగత లింక్, పిన్‌తో మాత్రమే తెరవబడతాయి." },
  secureAccessAction: { en: "Go to family sign in", te: "కుటుంబ సైన్ ఇన్‌కు వెళ్లండి" },

  // ── Admin · family cases ─────────────────────────────────────────────────
  casesTitle: { en: "Family Cases", te: "కుటుంబ కేసులు" },
  casesSubtitle: { en: "Every enrolled family, the assessment assigned to them, and how far they have got.", te: "నమోదైన ప్రతి కుటుంబం, వారికి కేటాయించిన మూల్యాంకనం, వారి పురోగతి." },
  caseNew: { en: "New family case", te: "కొత్త కుటుంబ కేసు" },
  caseCreateTitle: { en: "Create family case", te: "కుటుంబ కేసు సృష్టించండి" },
  caseCreateIntro: { en: "Record what you collected in the field. Credentials are generated automatically.", te: "మీరు క్షేత్రంలో సేకరించిన వివరాలు నమోదు చేయండి. ప్రవేశ వివరాలు ఆటోమేటిక్‌గా తయారవుతాయి." },
  caseDeceased: { en: "Deceased person", te: "మరణించిన వ్యక్తి" },
  caseFamilyHead: { en: "Family head", te: "కుటుంబ పెద్ద" },
  caseRelationship: { en: "Relationship", te: "సంబంధం" },
  casePhone: { en: "Phone number", te: "ఫోన్ నంబర్" },
  caseDistrict: { en: "District", te: "జిల్లా" },
  caseVillage: { en: "Village", te: "గ్రామం" },
  caseLanguage: { en: "Preferred language", te: "ఇష్టపడే భాష" },
  caseSurvey: { en: "Assigned assessment", te: "కేటాయించిన మూల్యాంకనం" },
  caseNotes: { en: "Notes", te: "గమనికలు" },
  caseValidity: { en: "Access valid for", te: "ప్రవేశ చెల్లుబాటు" },
  caseNDays: { en: "{n} days", te: "{n} రోజులు" },
  caseCreateAction: { en: "Create case & generate access", te: "కేసు సృష్టించి ప్రవేశం ఇవ్వండి" },
  caseCreated: { en: "Family case created", te: "కుటుంబ కేసు సృష్టించబడింది" },
  caseCredentials: { en: "Access credentials", te: "ప్రవేశ వివరాలు" },
  caseSecureLink: { en: "Secure link", te: "సురక్షిత లింక్" },
  caseTempPin: { en: "Temporary PIN", te: "తాత్కాలిక పిన్" },
  caseQrCode: { en: "QR code", te: "QR కోడ్" },
  caseRegeneratePin: { en: "Regenerate PIN", te: "పిన్ మళ్లీ తయారు చేయండి" },
  caseRegenerateLink: { en: "Regenerate link", te: "లింక్ మళ్లీ తయారు చేయండి" },
  caseReopen: { en: "Reopen case", te: "కేసును తిరిగి తెరవండి" },
  caseExtend: { en: "Extend access", te: "ప్రవేశాన్ని పొడిగించండి" },
  casePrintSlip: { en: "Print slip", te: "స్లిప్ ప్రింట్ చేయండి" },
  caseDownloadQr: { en: "Download QR", te: "QR డౌన్‌లోడ్" },
  caseEmailLink: { en: "Email link", te: "లింక్ ఇమెయిల్ చేయండి" },
  caseTimeline: { en: "Case timeline", te: "కేసు కాలరేఖ" },
  caseOfficer: { en: "Officer", te: "అధికారి" },
  caseSubmittedOn: { en: "Submitted", te: "సమర్పించినది" },
  caseExpiresIn: { en: "Expires in {n} days", te: "{n} రోజుల్లో గడువు ముగుస్తుంది" },
  caseExpiredOn: { en: "Expired", te: "గడువు ముగిసింది" },
  caseViewResponse: { en: "View response", te: "స్పందన చూడండి" },
  caseNoneTitle: { en: "No family cases yet", te: "ఇంకా కుటుంబ కేసులు లేవు" },
  caseNoneBody: { en: "Create a case for a family an officer has visited. The system mints their link, QR and PIN.", te: "అధికారి సందర్శించిన కుటుంబానికి కేసు సృష్టించండి. వ్యవస్థ వారి లింక్, QR, పిన్‌ను తయారు చేస్తుంది." },
  caseSearchPlaceholder: { en: "Search reference, family, phone, district…", te: "సూచన, కుటుంబం, ఫోన్, జిల్లా వెతకండి…" },
  caseDeleteConfirm: { en: "Delete this family case? Any submitted response is kept.", te: "ఈ కుటుంబ కేసును తొలగించాలా? సమర్పించిన స్పందన అలాగే ఉంటుంది." },

  // ── Admin · case status ──────────────────────────────────────────────────
  statusNotStarted: { en: "Not started", te: "ప్రారంభించలేదు" },
  statusOpened: { en: "Opened", te: "తెరిచారు" },
  statusInProgress: { en: "In progress", te: "కొనసాగుతోంది" },
  statusCompleted: { en: "Completed", te: "పూర్తయింది" },
  statusExpired: { en: "Expired", te: "గడువు ముగిసింది" },
  statusReopened: { en: "Reopened", te: "తిరిగి తెరిచారు" },

  // ── Share / QR manager ───────────────────────────────────────────────────
  shareSurvey: { en: "Share survey", te: "సర్వేను పంచుకోండి" },
  shareVia: { en: "Share via", te: "దీని ద్వారా పంచుకోండి" },
  shareEmail: { en: "Email", te: "ఇమెయిల్" },
  downloadQr: { en: "Download QR", te: "QR డౌన్‌లోడ్" },
  printQr: { en: "Print QR", te: "QR ప్రింట్" },
  regenerateQr: { en: "Generate new QR", te: "కొత్త QR రూపొందించండి" },
  regenerateQrConfirm: { en: "This retires the current link. Any QR already printed or shared will stop working. Continue?", te: "ఇది ప్రస్తుత లింక్‌ను రద్దు చేస్తుంది. ఇప్పటికే ప్రింట్ చేసిన లేదా పంచుకున్న QR పనిచేయదు. కొనసాగించాలా?" },
  regenerateQrDone: { en: "A new link and QR code have been generated.", te: "కొత్త లింక్, QR కోడ్ రూపొందించబడ్డాయి." },
  shareMessage: { en: "You are invited to a confidential well-being assessment. It opens directly — no login needed:", te: "గోప్యమైన శ్రేయస్సు మూల్యాంకనానికి మీకు ఆహ్వానం. ఇది నేరుగా తెరుచుకుంటుంది — లాగిన్ అవసరం లేదు:" },
  surveyLink: { en: "Secure survey link", te: "సురక్షిత సర్వే లింక్" },
  scanToBegin: { en: "Scan this code with your phone camera to begin", te: "ప్రారంభించడానికి మీ ఫోన్ కెమెరాతో ఈ కోడ్‌ను స్కాన్ చేయండి" },
  scanToOpen: { en: "Scan to open", te: "తెరవడానికి స్కాన్ చేయండి" },
  orOpenLink: { en: "Or open this link in any browser", te: "లేదా ఏదైనా బ్రౌజర్‌లో ఈ లింక్‌ను తెరవండి" },
  noLoginNeeded: { en: "No login needed · Your answers stay confidential", te: "లాగిన్ అవసరం లేదు · మీ సమాధానాలు గోప్యంగా ఉంటాయి" },
  qrTitle: { en: "QR & Link Manager", te: "QR & లింక్ మేనేజర్" },
  qrSubtitle: { en: "Share a published survey with families. They scan, and the assessment opens immediately — no login.", te: "ప్రచురించిన సర్వేను కుటుంబాలతో పంచుకోండి. వారు స్కాన్ చేస్తే మూల్యాంకనం వెంటనే తెరుచుకుంటుంది — లాగిన్ లేదు." },
  qrNoPublished: { en: "No published surveys yet", te: "ఇంకా ప్రచురించిన సర్వేలు లేవు" },
  qrNoPublishedBody: { en: "Publish a survey and its QR code and secure link appear here.", te: "సర్వేను ప్రచురిస్తే దాని QR కోడ్, సురక్షిత లింక్ ఇక్కడ కనిపిస్తాయి." },
  qrSelectPrompt: { en: "Choose a survey to see its QR code and link.", te: "QR కోడ్, లింక్ చూడటానికి ఒక సర్వేను ఎంచుకోండి." },
  qrReach: { en: "Reach", te: "చేరిక" },
  qrOpens: { en: "Opens", te: "తెరిచినవి" },
  qrCompletion: { en: "Completion", te: "పూర్తి శాతం" },

  // ── Parent flow · support (the floating Help button) ─────────────────────
  needHelp: { en: "Need help?", te: "సహాయం కావాలా?" },
  helpTitle: { en: "This survey is confidential", te: "ఈ సర్వే గోప్యమైనది" },
  helpBody: {
    en: "Your answers are private and are never shown to anyone who knows you. If you or your family need immediate support, please contact your local emergency services, a trusted family member, or an available mental health professional.",
    te: "మీ సమాధానాలు గోప్యంగా ఉంటాయి; మిమ్మల్ని తెలిసిన ఎవరికీ చూపబడవు. మీకు లేదా మీ కుటుంబానికి తక్షణ సహాయం అవసరమైతే, దయచేసి మీ స్థానిక అత్యవసర సేవలను, నమ్మకమైన కుటుంబ సభ్యులను, లేదా అందుబాటులో ఉన్న మానసిక ఆరోగ్య నిపుణులను సంప్రదించండి.",
  },
  helpReminder: { en: "You can pause at any time. Your answers are saved on this device.", te: "మీరు ఎప్పుడైనా విరామం తీసుకోవచ్చు. మీ సమాధానాలు ఈ పరికరంలో సేవ్ అవుతాయి." },
  continueSurvey: { en: "Continue survey", te: "సర్వే కొనసాగించండి" },

  // ── Parent flow · skip & review ──────────────────────────────────────────
  skipped: { en: "Skipped", te: "దాటవేయబడింది" },
  skippedNote: { en: "Skipped — you can come back to this", te: "దాటవేయబడింది — మీరు దీనికి తిరిగి రావచ్చు" },
  unansweredTitle: { en: "Questions left unanswered", te: "సమాధానం ఇవ్వని ప్రశ్నలు" },
  unansweredBody: { en: "You can answer these now, or submit as they are. Nothing is required.", te: "మీరు వీటికి ఇప్పుడు సమాధానం ఇవ్వవచ్చు, లేదా ఉన్నట్టుగానే సమర్పించవచ్చు. ఏదీ తప్పనిసరి కాదు." },
  answerNow: { en: "Answer now", te: "ఇప్పుడే సమాధానం ఇవ్వండి" },
  submitAnyway: { en: "Submit anyway", te: "అలాగే సమర్పించండి" },
  completionLabel: { en: "Complete", te: "పూర్తయింది" },

  // ── Export workspace ─────────────────────────────────────────────────────
  exportTitle: { en: "Export", te: "ఎగుమతి" },
  exportSubtitle: { en: "Choose what to include, filter the responses, preview the result, then generate.", te: "ఏమి చేర్చాలో ఎంచుకోండి, స్పందనలను ఫిల్టర్ చేయండి, ఫలితాన్ని ముందుగా చూడండి, తర్వాత రూపొందించండి." },
  stepSurvey: { en: "Survey", te: "సర్వే" },
  stepQuestions: { en: "Questions", te: "ప్రశ్నలు" },
  stepFilters: { en: "Filters", te: "ఫిల్టర్లు" },
  stepFormat: { en: "Format", te: "ఫార్మాట్" },
  stepPreview: { en: "Preview", te: "ముందస్తు వీక్షణ" },
  scopeAll: { en: "Entire survey", te: "మొత్తం సర్వే" },
  scopeSections: { en: "Selected sections", te: "ఎంచుకున్న విభాగాలు" },
  scopeQuestions: { en: "Selected questions", te: "ఎంచుకున్న ప్రశ్నలు" },
  scopeRequired: { en: "Required only", te: "తప్పనిసరివి మాత్రమే" },
  scopeOptional: { en: "Optional only", te: "ఐచ్ఛికమైనవి మాత్రమే" },
  filterDate: { en: "Date range", te: "తేదీ పరిధి" },
  filterLanguage: { en: "Language", te: "భాష" },
  filterCompletion: { en: "Completion", te: "పూర్తి స్థాయి" },
  filterAll: { en: "All", te: "అన్నీ" },
  filterCompleteOnly: { en: "Complete only", te: "పూర్తయినవి మాత్రమే" },
  filterPartialOnly: { en: "Partial only", te: "పాక్షికమైనవి మాత్రమే" },
  includeSkipped: { en: "Include skipped questions", te: "దాటవేసిన ప్రశ్నలను చేర్చండి" },
  generate: { en: "Generate", te: "రూపొందించండి" },
  generating: { en: "Generating…", te: "రూపొందిస్తోంది…" },
  nothingToExport: { en: "No responses match these filters.", te: "ఈ ఫిల్టర్లకు సరిపోయే స్పందనలు లేవు." },

  // ── Administrator sign-in ────────────────────────────────────────────────
  // The /auth page shipped with every string hardcoded in English, so the
  // language toggle sitting in its own corner switched `mode` and changed
  // nothing on screen. These are the strings that were inline.
  authPrivateWorkspace: { en: "Private workspace", te: "ప్రైవేట్ వర్క్‌స్పేస్" },
  authHeadlineLine1: { en: "Every response", te: "ప్రతి స్పందన" },
  authHeadlineLine2: { en: "tells", te: "ఒక కథను" },
  authHeadlineAccent: { en: "a story.", te: "చెబుతుంది." },
  authLede: {
    en: "A secure, intelligent platform to create, publish and analyse family assessment surveys. Your data stays private. Your insights create impact.",
    te: "కుటుంబ మూల్యాంకన సర్వేలను రూపొందించడానికి, ప్రచురించడానికి, విశ్లేషించడానికి ఒక సురక్షిత వేదిక. మీ డేటా గోప్యంగా ఉంటుంది. మీ అంతర్దృష్టులు మార్పును తీసుకొస్తాయి.",
  },
  authTrustPrivate: { en: "Private", te: "గోప్యం" },
  authTrustSecure: { en: "Secure", te: "సురక్షితం" },
  authTrustTrusted: { en: "Trusted", te: "విశ్వసనీయం" },
  authTrustSuffix: { en: "— authorized access only", te: "— అధీకృత ప్రవేశం మాత్రమే" },
  authWelcomeBack: { en: "Welcome back", te: "తిరిగి స్వాగతం" },
  authSignInSubtitle: {
    en: "Sign in to continue to your secure workspace",
    te: "మీ సురక్షిత వర్క్‌స్పేస్‌కు కొనసాగడానికి సైన్ ఇన్ చేయండి",
  },
  authEmailLabel: { en: "Email address", te: "ఇమెయిల్ చిరునామా" },
  authEmailPlaceholder: { en: "admin@example.com", te: "admin@example.com" },
  authPasswordLabel: { en: "Password", te: "పాస్‌వర్డ్" },
  authPasswordPlaceholder: { en: "Enter your password", te: "మీ పాస్‌వర్డ్ నమోదు చేయండి" },
  authShowPassword: { en: "Show password", te: "పాస్‌వర్డ్ చూపించు" },
  authHidePassword: { en: "Hide password", te: "పాస్‌వర్డ్ దాచు" },
  authFooterNote: {
    en: "Private workspace for authorized administrators",
    te: "అధీకృత నిర్వాహకుల కోసం ప్రైవేట్ వర్క్‌స్పేస్",
  },
  authInvalidEmail: { en: "Enter a valid email address.", te: "సరైన ఇమెయిల్ చిరునామా నమోదు చేయండి." },
  authEnterPassword: { en: "Enter your password.", te: "మీ పాస్‌వర్డ్ నమోదు చేయండి." },
  authErrUnconfirmed: {
    en: "This account hasn't been confirmed yet. Please contact your administrator.",
    te: "ఈ ఖాతా ఇంకా ధృవీకరించబడలేదు. దయచేసి మీ నిర్వాహకుడిని సంప్రదించండి.",
  },
  // One message for a wrong password AND a non-existent account — telling them
  // apart would let someone enumerate which emails are registered.
  authErrInvalid: { en: "The email or password is incorrect.", te: "ఇమెయిల్ లేదా పాస్‌వర్డ్ సరైనది కాదు." },
  authErrGeneric: {
    en: "Couldn't sign in right now. Please check your connection and try again.",
    te: "ప్రస్తుతం సైన్ ఇన్ చేయలేకపోయాము. దయచేసి మీ కనెక్షన్‌ను సరిచూసి మళ్లీ ప్రయత్నించండి.",
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  settingsTitle: { en: "Settings", te: "సెట్టింగ్‌లు" },
  settingsGeneral: { en: "General", te: "సాధారణం" },
  settingsLanguage: { en: "Language", te: "భాష" },
  settingsVoice: { en: "Voice", te: "వాయిస్" },
  settingsAccessibility: { en: "Accessibility", te: "అందుబాటు" },
  settingsTheme: { en: "Theme", te: "థీమ్" },
  settingsNotifications: { en: "Notifications", te: "నోటిఫికేషన్లు" },
  settingsSecurity: { en: "Security", te: "భద్రత" },
  settingsResearch: { en: "Research", te: "పరిశోధన" },
  settingsAbout: { en: "About", te: "గురించి" },
  languageDesc: { en: "Choose how the family assessment and this console are shown.", te: "కుటుంబ మూల్యాంకనం, ఈ కన్సోల్ ఎలా చూపబడతాయో ఎంచుకోండి." },
  voiceAutoplay: { en: "Read questions aloud automatically", te: "ప్రశ్నలను ఆటోమేటిక్‌గా బిగ్గరగా చదవండి" },
  voiceAutoplayDesc: { en: "Each question is narrated as it appears, without tapping Listen.", te: "ప్రతి ప్రశ్న కనిపించగానే చదవబడుతుంది, “వినండి” నొక్కకుండానే." },
  voiceDefaultSpeed: { en: "Default speaking speed", te: "డిఫాల్ట్ మాట్లాడే వేగం" },
  voiceTest: { en: "Test voice", te: "వాయిస్ పరీక్షించండి" },
  voiceTestPhrase: { en: "This is how questions will be read aloud.", te: "ప్రశ్నలు ఇలా బిగ్గరగా చదవబడతాయి." },
  largeText: { en: "Larger text", te: "పెద్ద అక్షరాలు" },
  largeTextDesc: { en: "Increase text size across the whole platform.", te: "మొత్తం ప్లాట్‌ఫారమ్‌లో అక్షర పరిమాణాన్ని పెంచండి." },
  highContrast: { en: "Higher contrast", te: "ఎక్కువ కాంట్రాస్ట్" },
  highContrastDesc: { en: "Strengthen borders and text for easier reading.", te: "సులభంగా చదవడానికి అంచులను, అక్షరాలను ముదురుగా చేయండి." },
  themeLight: { en: "Light", te: "లేత" },
  themeDark: { en: "Dark", te: "ముదురు" },
  themeSystem: { en: "System", te: "సిస్టమ్" },
  themeDesc: { en: "Match your device, or pick a fixed appearance.", te: "మీ పరికరానికి సరిపోల్చండి, లేదా ఒక నిర్దిష్ట రూపాన్ని ఎంచుకోండి." },
} satisfies Dict;

export type DictKey = keyof typeof dict;

interface I18nState {
  mode: LangMode;
  setMode: (m: LangMode) => void;
}

const initialMode: LangMode =
  (typeof window !== "undefined" && (localStorage.getItem("langMode") as LangMode)) || "en";

export const useI18nStore = create<I18nState>((set) => ({
  mode: initialMode,
  setMode: (m) => {
    if (typeof window !== "undefined") localStorage.setItem("langMode", m);
    set({ mode: m });
  },
}));

/** The single language used for UI chrome (buttons, nav, field labels). */
export function chromeLang(mode: LangMode): Lang {
  return mode === "te" ? "te" : "en";
}

export function useLangMode() {
  return useI18nStore((s) => s.mode);
}

/** Replace `{name}` placeholders with values. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export type Translator = (key: DictKey, vars?: Record<string, string | number>) => string;

/** UI-chrome translator — always one language, never duplicated. */
export function useT(): Translator {
  const mode = useI18nStore((s) => s.mode);
  const lang = chromeLang(mode);
  // Memoised on the language, not rebuilt per render. An unstable identity here
  // is a trap for every caller: putting `t` in a useEffect/useMemo dependency
  // array — the natural thing to do, and what the lint rule asks for — would
  // otherwise re-run that effect on every single render. Now the identity
  // changes only when the language actually does.
  return useCallback<Translator>(
    (key, vars) => interpolate(dict[key]?.[lang] ?? String(key), vars),
    [lang],
  );
}

/** Non-hook translator for code that already holds a mode (e.g. narration). */
export function translate(mode: LangMode, key: DictKey, vars?: Record<string, string | number>): string {
  return interpolate(dict[key]?.[chromeLang(mode)] ?? String(key), vars);
}

export interface Bilingual {
  primary: string;
  /** Only present in "both" mode when a distinct translation exists. */
  secondary: string | null;
}

/**
 * Resolve authored content (title / prompt / option) for a display mode.
 * Single-language modes always yield ONE string; Telugu falls back to English
 * only when no Telugu translation was authored.
 */
export function renderBilingual(mode: LangMode, en: string, te?: string | null): Bilingual {
  const teVal = te && te.trim() ? te.trim() : null;
  if (mode === "te") return { primary: teVal ?? en, secondary: null };
  return { primary: en, secondary: null };
}

/** Convenience for callers that still think in terms of a single Lang. */
export function useLang(): Lang {
  return chromeLang(useI18nStore((s) => s.mode));
}

export function useDocLang() {
  const mode = useLangMode();
  useEffect(() => {
    document.documentElement.lang = chromeLang(mode);
  }, [mode]);
}
