import { create } from "zustand";
import { useEffect } from "react";

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
  appName: { en: "AP Police Family Assessment Platform", te: "ఏపీ పోలీసు కుటుంబ మూల్యాంకన వేదిక" },
  appShort: { en: "Family Assessment Platform", te: "కుటుంబ మూల్యాంకన వేదిక" },
  govOf: { en: "Government of Andhra Pradesh · Department of Police", te: "ఆంధ్రప్రదేశ్ ప్రభుత్వం · పోలీసు శాఖ" },
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
  navHelp: { en: "Help & About", te: "సహాయం & గురించి" },
  navMore: { en: "More", te: "మరిన్ని" },
  navMoreTitle: { en: "More", te: "మరిన్ని" },
  navGroupWorkspace: { en: "Workspace", te: "వర్క్‌స్పేస్" },
  navGroupSurveys: { en: "Surveys", te: "సర్వేలు" },
  navGroupField: { en: "Families & Field", te: "కుటుంబాలు & క్షేత్రం" },
  navGroupInsights: { en: "Insights", te: "అంతర్దృష్టులు" },
  navGroupGovernance: { en: "Governance", te: "పరిపాలన" },

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
  confidentialNoLogin: { en: "Confidential · no login required", te: "గోప్యం · లాగిన్ అవసరం లేదు" },
  progressSaved: { en: "Your progress is saved on this device", te: "మీ పురోగతి ఈ పరికరంలో సేవ్ చేయబడుతుంది" },
  questionXofY: { en: "Question {i} of {n}", te: "ప్రశ్న {i} / {n}" },
  aboutMinutesRemaining: { en: "About {n} minutes remaining", te: "సుమారు {n} నిమిషాలు మిగిలి ఉన్నాయి" },
  aboutOneMinuteRemaining: { en: "About a minute remaining", te: "సుమారు ఒక నిమిషం మిగిలి ఉంది" },
  lessThanMinuteRemaining: { en: "Less than a minute remaining", te: "ఒక నిమిషం కంటే తక్కువ మిగిలి ఉంది" },
  aboutMinutes: { en: "About {n} minutes", te: "సుమారు {n} నిమిషాలు" },
  nQuestions: { en: "{n} questions", te: "{n} ప్రశ్నలు" },

  // ── Parent flow · welcome ────────────────────────────────────────────────
  welcomeEyebrow: { en: "A well-being conversation", te: "శ్రేయస్సు సంభాషణ" },
  welcomeIntro: { en: "This is a gentle set of questions about how you and your family are doing. Please take your time — there are no right or wrong answers.", te: "ఇవి మీరు మరియు మీ కుటుంబం ఎలా ఉన్నారో తెలుసుకునే సున్నితమైన ప్రశ్నలు. దయచేసి మీ సమయం తీసుకోండి — సరైన లేదా తప్పు సమాధానాలు అంటూ ఏమీ లేవు." },
  estimatedTime: { en: "Estimated time", te: "అంచనా సమయం" },
  privacyTitle: { en: "Your privacy", te: "మీ గోప్యత" },
  privacyBody: { en: "Your answers are confidential and are used only to understand and support family well-being. No login or personal details are required.", te: "మీ సమాధానాలు గోప్యంగా ఉంచబడతాయి; కుటుంబ శ్రేయస్సును అర్థం చేసుకోవడానికి, తోడ్పడటానికి మాత్రమే వినియోగించబడతాయి. లాగిన్ లేదా వ్యక్తిగత వివరాలు అవసరం లేదు." },
  supportTitle: { en: "We are with you", te: "మేము మీతో ఉన్నాము" },
  supportBody: { en: "Answer at your own pace. You can pause at any time — your progress is saved automatically on this device.", te: "మీ సొంత వేగంతో సమాధానం ఇవ్వండి. మీరు ఎప్పుడైనా విరామం తీసుకోవచ్చు — మీ పురోగతి ఈ పరికరంలో ఆటోమేటిక్‌గా సేవ్ అవుతుంది." },
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

  // ── Share / QR manager ───────────────────────────────────────────────────
  shareSurvey: { en: "Share survey", te: "సర్వేను పంచుకోండి" },
  shareVia: { en: "Share via", te: "దీని ద్వారా పంచుకోండి" },
  shareWhatsApp: { en: "WhatsApp", te: "వాట్సాప్" },
  shareSms: { en: "SMS", te: "SMS" },
  shareEmail: { en: "Email", te: "ఇమెయిల్" },
  downloadQr: { en: "Download QR", te: "QR డౌన్‌లోడ్" },
  printQr: { en: "Print QR", te: "QR ప్రింట్" },
  shareMessage: { en: "You are invited to a confidential well-being survey from AP Police. It opens directly — no login needed:", te: "ఏపీ పోలీసు నుండి గోప్యమైన శ్రేయస్సు సర్వేకు మీకు ఆహ్వానం. ఇది నేరుగా తెరుచుకుంటుంది — లాగిన్ అవసరం లేదు:" },
  surveyLink: { en: "Secure survey link", te: "సురక్షిత సర్వే లింక్" },
  scanToBegin: { en: "Scan this code with your phone camera to begin", te: "ప్రారంభించడానికి మీ ఫోన్ కెమెరాతో ఈ కోడ్‌ను స్కాన్ చేయండి" },
  orOpenLink: { en: "Or open this link in any browser", te: "లేదా ఏదైనా బ్రౌజర్‌లో ఈ లింక్‌ను తెరవండి" },
  noLoginNeeded: { en: "No login needed · Your answers stay confidential", te: "లాగిన్ అవసరం లేదు · మీ సమాధానాలు గోప్యంగా ఉంటాయి" },
  qrTitle: { en: "QR & Link Manager", te: "QR & లింక్ మేనేజర్" },
  qrSubtitle: { en: "Share a published survey with families. They scan, and the assessment opens immediately — no login.", te: "ప్రచురించిన సర్వేను కుటుంబాలతో పంచుకోండి. వారు స్కాన్ చేస్తే మూల్యాంకనం వెంటనే తెరుచుకుంటుంది — లాగిన్ లేదు." },
  qrNoPublished: { en: "No published surveys yet", te: "ఇంకా ప్రచురించిన సర్వేలు లేవు" },
  qrNoPublishedBody: { en: "Publish a survey and its QR code and secure link appear here.", te: "సర్వేను ప్రచురిస్తే దాని QR కోడ్, సురక్షిత లింక్ ఇక్కడ కనిపిస్తాయి." },
  qrSelectPrompt: { en: "Choose a survey to see its QR code and link.", te: "QR కోడ్, లింక్ చూడటానికి ఒక సర్వేను ఎంచుకోండి." },

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
  return (key, vars) => interpolate(dict[key]?.[lang] ?? String(key), vars);
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
