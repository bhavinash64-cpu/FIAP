import { create } from "zustand";
import { useEffect } from "react";

export type Lang = "en" | "te";

type Dict = Record<string, { en: string; te: string }>;

// Core UI strings. Telugu is professional-grade seed; extend from admin later.
export const dict: Dict = {
  appName: { en: "AP Police Family Assessment Platform", te: "ఏపీ పోలీసు కుటుంబ మూల్యాంకన వేదిక" },
  appShort: { en: "Family Assessment Platform", te: "కుటుంబ మూల్యాంకన వేదిక" },
  govOf: { en: "Government of Andhra Pradesh · Department of Police", te: "ఆంధ్రప్రదేశ్ ప్రభుత్వం · పోలీసు శాఖ" },
  signIn: { en: "Sign in", te: "సైన్ ఇన్" },
  signUp: { en: "Create account", te: "ఖాతా సృష్టించండి" },
  signOut: { en: "Sign out", te: "సైన్ అవుట్" },
  email: { en: "Email", te: "ఇమెయిల్" },
  password: { en: "Password", te: "పాస్‌వర్డ్" },
  fullName: { en: "Full name", te: "పూర్తి పేరు" },
  dashboard: { en: "Dashboard", te: "డాష్‌బోర్డ్" },
  participants: { en: "Participants", te: "పాల్గొనేవారు" },
  assessments: { en: "Assessments", te: "మూల్యాంకనలు" },
  analytics: { en: "Analytics", te: "విశ్లేషణలు" },
  auditLog: { en: "Audit log", te: "ఆడిట్ లాగ్" },
  admin: { en: "Admin", te: "అడ్మిన్" },
  users: { en: "Users", te: "వినియోగదారులు" },
  settings: { en: "Settings", te: "అమరికలు" },
  language: { en: "Language", te: "భాష" },
  english: { en: "English", te: "ఇంగ్లీష్" },
  telugu: { en: "Telugu", te: "తెలుగు" },
  newParticipant: { en: "New participant", te: "కొత్త పాల్గొనేవారు" },
  consent: { en: "Informed consent", te: "సమాచార సమ్మతి" },
  consentAgree: { en: "I have read and understood, and I voluntarily consent to participate.", te: "నేను చదివాను, అర్థం చేసుకున్నాను, స్వచ్ఛందంగా పాల్గొనేందుకు అంగీకరిస్తున్నాను." },
  continue: { en: "Continue", te: "కొనసాగించండి" },
  back: { en: "Back", te: "వెనుకకు" },
  next: { en: "Next", te: "తర్వాత" },
  save: { en: "Save", te: "సేవ్ చేయండి" },
  submit: { en: "Submit", te: "సమర్పించండి" },
  cancel: { en: "Cancel", te: "రద్దు" },
  saving: { en: "Saving…", te: "సేవ్ అవుతోంది…" },
  saved: { en: "Saved", te: "సేవ్ అయింది" },
  progress: { en: "Progress", te: "పురోగతి" },
  question: { en: "Question", te: "ప్రశ్న" },
  of: { en: "of", te: "లో" },
  completed: { en: "Completed", te: "పూర్తయింది" },
  inProgress: { en: "In progress", te: "కొనసాగుతోంది" },
  district: { en: "District", te: "జిల్లా" },
  mandal: { en: "Mandal", te: "మండలం" },
  hospital: { en: "Hospital", te: "ఆసుపత్రి" },
  code: { en: "Participant code", te: "పాల్గొనేవారి కోడ్" },
  studyGroup: { en: "Study group", te: "అధ్యయన బృందం" },
  case: { en: "Case (attempted suicide)", te: "కేసు (ఆత్మహత్య ప్రయత్నం)" },
  control: { en: "Control", te: "కంట్రోల్" },
  age: { en: "Age", te: "వయస్సు" },
  gender: { en: "Gender", te: "లింగం" },
  male: { en: "Male", te: "పురుషుడు" },
  female: { en: "Female", te: "స్త్రీ" },
  other: { en: "Other", te: "ఇతర" },
  ageBandA: { en: "18–24 years", te: "18–24 సంవత్సరాలు" },
  ageBandB: { en: "25–39 years", te: "25–39 సంవత్సరాలు" },
  start: { en: "Start", te: "ప్రారంభం" },
  resume: { en: "Resume", te: "కొనసాగించండి" },
  review: { en: "Review", te: "సమీక్షించండి" },
  export: { en: "Export CSV", te: "CSV ఎగుమతి" },
  totalParticipants: { en: "Total participants", te: "మొత్తం పాల్గొనేవారు" },
  casesEnrolled: { en: "Cases enrolled", te: "కేసులు" },
  controlsEnrolled: { en: "Controls enrolled", te: "నియంత్రణలు" },
  assessmentsCompleted: { en: "Assessments completed", te: "పూర్తయిన మూల్యాంకనలు" },
  loading: { en: "Loading…", te: "లోడ్ అవుతోంది…" },
  riskScoreNote: { en: "Risk scoring: placeholder for validated multivariate model.", te: "రిస్క్ స్కోరింగ్: ధృవీకరించబడిన నమూనా కోసం ప్లేస్‌హోల్డర్." },
};

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  lang: (typeof window !== "undefined" && (localStorage.getItem("lang") as Lang)) || "en",
  setLang: (l) => {
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
    set({ lang: l });
  },
}));

export function useT() {
  const lang = useI18nStore((s) => s.lang);
  return (key: keyof typeof dict) => dict[key]?.[lang] ?? String(key);
}

export function useLang() {
  return useI18nStore((s) => s.lang);
}

/** Utility: pick a bilingual value inline (for instrument items) */
export function pick(lang: Lang, en: string, te?: string) {
  return lang === "te" && te ? te : en;
}

export function useDocLang() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}
