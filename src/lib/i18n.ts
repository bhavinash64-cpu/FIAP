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

// Core UI-chrome strings. In "both" mode, chrome uses a single language (English)
// so buttons/labels are never duplicated — the dual display is reserved for
// authored content (titles, prompts, options).
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
  // Sidebar navigation — switches fully with the language toggle
  navOverview: { en: "Overview", te: "అవలోకనం" },
  navSurveys: { en: "Surveys", te: "సర్వేలు" },
  navQuestionBank: { en: "Question Bank", te: "ప్రశ్న బ్యాంక్" },
  navResponses: { en: "Responses", te: "స్పందనలు" },
  navAnalytics: { en: "Analytics", te: "విశ్లేషణలు" },
  navReports: { en: "Reports", te: "నివేదికలు" },
  navSettings: { en: "Settings", te: "సెట్టింగ్‌లు" },
  language: { en: "Language", te: "భాష" },
  english: { en: "English", te: "ఇంగ్లీష్" },
  telugu: { en: "Telugu", te: "తెలుగు" },
  continue: { en: "Continue", te: "కొనసాగించండి" },
  back: { en: "Back", te: "వెనుకకు" },
  next: { en: "Next", te: "తర్వాత" },
  save: { en: "Save", te: "సేవ్ చేయండి" },
  submit: { en: "Submit", te: "సమర్పించండి" },
  cancel: { en: "Cancel", te: "రద్దు" },
  saving: { en: "Saving…", te: "సేవ్ అవుతోంది…" },
  saved: { en: "Saved", te: "సేవ్ అయింది" },
  question: { en: "Question", te: "ప్రశ్న" },
  of: { en: "of", te: "లో" },
  answered: { en: "answered", te: "సమాధానమిచ్చారు" },
  requiredAnswer: { en: "This question requires an answer", te: "ఈ ప్రశ్నకు సమాధానం అవసరం" },
  yourAnswer: { en: "Your answer…", te: "మీ సమాధానం…" },
  selectOption: { en: "Select an option", te: "ఎంపికను ఎంచుకోండి" },
  yes: { en: "Yes", te: "అవును" },
  no: { en: "No", te: "కాదు" },
  loading: { en: "Loading…", te: "లోడ్ అవుతోంది…" },
  noQuestionsYet: { en: "This survey doesn't have any questions yet.", te: "ఈ సర్వేలో ఇంకా ప్రశ్నలు లేవు." },
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

/** UI-chrome translator — always one language, never duplicated. */
export function useT() {
  const mode = useI18nStore((s) => s.mode);
  const lang = chromeLang(mode);
  return (key: DictKey) => dict[key]?.[lang] ?? String(key);
}

export interface Bilingual {
  primary: string;
  /** Only present in "both" mode when a distinct translation exists. */
  secondary: string | null;
}

/**
 * Resolve authored content (title / prompt / option) for a display mode.
 * This is the single source of truth that fixes duplicated bilingual text:
 * single-language modes always yield ONE string; "both" yields two only when
 * a real, distinct translation exists.
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
