import { create } from "zustand";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/i18n";

/**
 * Narration for the guided assessment, built on the browser SpeechSynthesis API.
 *
 * The API is old and quirky; three quirks drive the shape of this module:
 *
 *  1. getVoices() is empty on first call in Chrome/Edge — the list arrives later
 *     via `voiceschanged`. A component that reads it once during its first
 *     render concludes "no voices" and disables itself forever. Hence the
 *     module-level cache + subscription below.
 *  2. Chrome silently stops speaking an utterance longer than ~15 seconds. The
 *     fix is not to hand it long text: speak() splits into short chunks and
 *     queues them, and a heartbeat nudges the queue if the engine stalls.
 *  3. pause() is a no-op on several mobile engines. Rather than show a Paused
 *     button while audio keeps playing, pause() verifies it took effect and
 *     falls back to stopping.
 */

const RATE_KEY = "voiceRate";
const AUTOPLAY_KEY = "voiceAutoplay";

/** Offered on the question screen; 1 is the engine default. */
export const VOICE_RATES = [0.7, 0.85, 1, 1.25] as const;
export const DEFAULT_RATE = 0.85;

/** Long text is split below this so no single utterance can hit Chrome's cutoff. */
const MAX_CHUNK = 160;

function readRate(): number {
  if (typeof window === "undefined") return DEFAULT_RATE;
  const raw = Number(localStorage.getItem(RATE_KEY));
  return VOICE_RATES.includes(raw as (typeof VOICE_RATES)[number]) ? raw : DEFAULT_RATE;
}

function readAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTOPLAY_KEY) === "1";
}

interface VoiceSettingsState {
  rate: number;
  /** Read each question aloud as it appears, without tapping Listen. */
  autoplay: boolean;
  setRate: (r: number) => void;
  setAutoplay: (v: boolean) => void;
}

export const useVoiceSettings = create<VoiceSettingsState>((set) => ({
  rate: readRate(),
  autoplay: readAutoplay(),
  setRate: (r) => {
    if (typeof window !== "undefined") localStorage.setItem(RATE_KEY, String(r));
    set({ rate: r });
  },
  setAutoplay: (v) => {
    if (typeof window !== "undefined") localStorage.setItem(AUTOPLAY_KEY, v ? "1" : "0");
    set({ autoplay: v });
  },
}));

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

// ── Voice list: cached at module level, refreshed on `voiceschanged` ─────────

let cachedVoices: SpeechSynthesisVoice[] = [];
const voiceSubscribers = new Set<() => void>();

function refreshVoices() {
  if (!speechSupported()) return;
  const next = window.speechSynthesis.getVoices();
  // Keep the last non-empty list: some engines briefly report [] mid-session.
  if (next.length === 0 && cachedVoices.length > 0) return;
  if (next.length === cachedVoices.length && next.every((v, i) => v.voiceURI === cachedVoices[i]?.voiceURI)) return;
  cachedVoices = next;
  voiceSubscribers.forEach((fn) => fn());
}

if (speechSupported()) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
  // Safari never fires `voiceschanged`; one deferred read covers it.
  window.setTimeout(refreshVoices, 250);
  // Chrome keeps speaking across a client-side navigation or reload otherwise.
  window.addEventListener("beforeunload", () => window.speechSynthesis.cancel());
}

function subscribeVoices(cb: () => void) {
  voiceSubscribers.add(cb);
  return () => voiceSubscribers.delete(cb);
}

export function useVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(
    subscribeVoices,
    () => cachedVoices,
    () => cachedVoices,
  );
}

/**
 * BCP-47 tags to try, best first, for each interface language.
 * Telugu narration should also accept the pan-Indic engines: on many Android
 * and Windows builds a single "Indian" neural voice serves te/hi/ta, and when
 * no dedicated te-IN voice is installed hi-IN reads Telugu script far more
 * intelligibly than an en-US voice would (shared Brahmic phonology).
 */
const LANG_PREFS: Record<Lang, string[]> = {
  te: ["te-in", "te", "hi-in", "hi", "kn", "ta"],
  en: ["en-in", "en-gb", "en-au", "en-us", "en"],
};

export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  for (const pref of LANG_PREFS[lang]) {
    // Prefer a local voice for the tag, then any voice for it — a network voice
    // still speaks, it just needs a connection.
    const local = voices.find((v) => norm(v).startsWith(pref) && v.localService);
    if (local) return local;
    const any = voices.find((v) => norm(v).startsWith(pref));
    if (any) return any;
  }
  return null;
}

/**
 * Split on sentence boundaries (including the Telugu danda) and hard-wrap
 * anything still over the limit, so every utterance stays well inside the
 * engine's cutoff.
 */
export function chunkText(text: string, max = MAX_CHUNK): string[] {
  const pieces = text.trim().match(/[^.!?।\n]+[.!?।\n]*\s*/g) ?? [text];
  const out: string[] = [];
  let current = "";

  const flushLongTail = () => {
    while (current.length > max) {
      let cut = current.lastIndexOf(" ", max);
      if (cut <= 0) cut = max;
      out.push(current.slice(0, cut).trim());
      current = current.slice(cut);
    }
  };

  for (const piece of pieces) {
    if (current && (current + piece).length > max) {
      out.push(current.trim());
      current = piece;
    } else {
      current += piece;
    }
    flushLongTail();
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

export type NarrationStatus = "idle" | "speaking" | "paused";

export interface Narrator {
  status: NarrationStatus;
  /** True whenever a speech engine exists — the button is offered, and narration attempted. */
  available: boolean;
  /** False when no voice matching this language was enumerated — drives a soft hint, not a disable. */
  hasLangVoice: boolean;
  supported: boolean;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  /** Re-speak the last text from the top. */
  replay: () => void;
  stop: () => void;
  rate: number;
  setRate: (r: number) => void;
}

export function useNarrator(lang: Lang): Narrator {
  const voices = useVoices();
  const rate = useVoiceSettings((s) => s.rate);
  const setRateStored = useVoiceSettings((s) => s.setRate);
  const [status, setStatus] = useState<NarrationStatus>("idle");

  const lastText = useRef("");
  /**
   * Bumped before every cancel(). cancel() fires onend/onerror on utterances
   * already queued, and those handlers would otherwise reset the status of the
   * NEW utterance that replaced them.
   */
  const token = useRef(0);
  const voice = pickVoice(voices, lang);
  const supported = speechSupported();
  // If the engine exists at all, let the respondent try. Disabling the button
  // whenever no exact te-IN voice is enumerated was the bug behind "voice
  // doesn't come in Telugu": the list loads late, a network voice may not show
  // up until first use, and even with no match the utterance is spoken with its
  // lang tag set so a device with Telugu TTS still narrates. A dead button
  // helps no one; an attempt that the platform declines is no worse.
  const available = supported;
  // Whether a real voice for THIS language was found — drives the soft hint.
  const hasLangVoice = voice !== null || voices.length === 0;

  const stop = useCallback(() => {
    token.current += 1;
    if (speechSupported()) window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const speakText = useCallback(
    (text: string, atRate: number) => {
      if (!speechSupported() || !text.trim()) return;
      const synth = window.speechSynthesis;
      token.current += 1;
      const mine = token.current;
      synth.cancel();
      lastText.current = text;

      const chunks = chunkText(text);
      chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? (lang === "te" ? "te-IN" : "en-IN");
        u.rate = atRate;
        u.pitch = 1;
        u.volume = 1;
        if (i === chunks.length - 1) {
          u.onend = () => {
            if (mine === token.current) setStatus("idle");
          };
        }
        u.onerror = () => {
          if (mine === token.current) setStatus("idle");
        };
        synth.speak(u);
      });
      setStatus("speaking");
    },
    [voice, lang],
  );

  const speak = useCallback((text: string) => speakText(text, rate), [speakText, rate]);
  const replay = useCallback(() => speakText(lastText.current, rate), [speakText, rate]);

  const pause = useCallback(() => {
    if (!speechSupported()) return;
    const synth = window.speechSynthesis;
    synth.pause();
    setStatus("paused");
    // Android Chrome accepts pause() and keeps talking. If it didn't take, stop
    // instead — a control that says Paused while audio plays is worse than one
    // that restarts.
    window.setTimeout(() => {
      if (!synth.paused && synth.speaking) {
        token.current += 1;
        synth.cancel();
        setStatus("idle");
      }
    }, 150);
  }, []);

  const resume = useCallback(() => {
    if (!speechSupported()) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, []);

  /** Rate can't change mid-utterance — restart at the new speed if speaking. */
  const setRate = useCallback(
    (r: number) => {
      setRateStored(r);
      if (status !== "idle" && lastText.current) speakText(lastText.current, r);
    },
    [setRateStored, speakText, status],
  );

  // Anti-stall heartbeat. resume() on a queue that isn't paused is a no-op, and
  // it un-wedges the engine when Chrome drops the queue mid-run.
  useEffect(() => {
    if (status !== "speaking") return;
    const id = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.speaking && !synth.paused) synth.resume();
    }, 8000);
    return () => window.clearInterval(id);
  }, [status]);

  // Never let narration outlive the screen that started it.
  useEffect(() => stop, [stop]);

  // Leaving the tab should silence it, not talk to an empty room.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stop]);

  return { status, available, hasLangVoice, supported, speak, pause, resume, replay, stop, rate, setRate };
}
