import { create } from "zustand";
import { useEffect } from "react";

/**
 * Display preferences that apply everywhere — set once in Settings, felt across
 * the admin console AND the family assessment.
 *
 * Each is a class on <html> rather than component state, so a preference reaches
 * the public survey route (which shares no React tree with Settings) for free.
 * The classes are defined in index.css.
 */

const LARGE_TEXT_KEY = "prefLargeText";
const HIGH_CONTRAST_KEY = "prefHighContrast";

interface PreferencesState {
  largeText: boolean;
  highContrast: boolean;
  setLargeText: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
}

function read(key: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key) === "1";
}

export const usePreferences = create<PreferencesState>((set) => ({
  largeText: read(LARGE_TEXT_KEY),
  highContrast: read(HIGH_CONTRAST_KEY),
  setLargeText: (v) => {
    if (typeof window !== "undefined") localStorage.setItem(LARGE_TEXT_KEY, v ? "1" : "0");
    set({ largeText: v });
  },
  setHighContrast: (v) => {
    if (typeof window !== "undefined") localStorage.setItem(HIGH_CONTRAST_KEY, v ? "1" : "0");
    set({ highContrast: v });
  },
}));

/**
 * Mount once near the app root. Reflects the stored preferences onto <html> and
 * keeps them in sync — including across tabs, so changing text size in one place
 * updates a survey open in another.
 */
export function usePreferenceEffects() {
  const largeText = usePreferences((s) => s.largeText);
  const highContrast = usePreferences((s) => s.highContrast);
  const setLargeText = usePreferences((s) => s.setLargeText);
  const setHighContrast = usePreferences((s) => s.setHighContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("pref-large-text", largeText);
    root.classList.toggle("pref-high-contrast", highContrast);
  }, [largeText, highContrast]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LARGE_TEXT_KEY) setLargeText(e.newValue === "1");
      if (e.key === HIGH_CONTRAST_KEY) setHighContrast(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setLargeText, setHighContrast]);
}
