import { useEffect, useRef, useState } from "react";
import { Volume2, Pause, Play, RotateCcw, Gauge, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLang, useT } from "@/lib/i18n";
import { useNarrator, useVoiceSettings, VOICE_RATES } from "@/lib/voice";
import { cn } from "@/lib/utils";

/**
 * The Listen control on a question screen.
 *
 * `resetKey` identifies what is currently on screen (the question id). When it
 * changes, narration of the previous question is stopped before anything else
 * happens — the alternative is question 13 being read over question 12.
 */
export function VoiceControl({ text, resetKey }: { text: string; resetKey: string }) {
  const lang = useLang();
  const t = useT();
  const narrator = useNarrator(lang);
  const autoplay = useVoiceSettings((s) => s.autoplay);
  const [hasSpoken, setHasSpoken] = useState(false);

  // Kept in refs so the reset effect below depends only on resetKey. Depending
  // on the callbacks directly would re-fire it whenever the voice list resolves
  // or the rate changes, cutting off narration the respondent just started.
  const speakRef = useRef(narrator.speak);
  const stopRef = useRef(narrator.stop);
  const textRef = useRef(text);
  speakRef.current = narrator.speak;
  stopRef.current = narrator.stop;
  textRef.current = text;

  useEffect(() => {
    stopRef.current();
    setHasSpoken(false);
    if (!autoplay) return;
    // A beat of silence between screens; without it the engine can swallow the
    // opening word of the new question.
    const id = window.setTimeout(() => {
      speakRef.current(textRef.current);
      setHasSpoken(true);
    }, 220);
    return () => window.clearTimeout(id);
  }, [resetKey, autoplay, lang]);

  if (!narrator.available) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              variant="outline"
              disabled
              className="h-12 gap-2 rounded-pill px-5 text-base"
              aria-label={t("voiceUnavailable")}
            >
              <VolumeX className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {t("listen")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-center">{t("voiceUnavailable")}</TooltipContent>
      </Tooltip>
    );
  }

  const speaking = narrator.status === "speaking";
  const paused = narrator.status === "paused";

  function primaryAction() {
    if (speaking) return narrator.pause();
    if (paused) return narrator.resume();
    narrator.speak(text);
    setHasSpoken(true);
  }

  const primaryLabel = speaking ? t("pause") : paused ? t("resume") : t("listen");
  const PrimaryIcon = speaking ? Pause : paused ? Play : Volume2;
  // Only meaningful for Telugu — English always resolves to some voice.
  const showLangHint = lang === "te" && !narrator.hasLangVoice;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={speaking || paused ? "default" : "outline"}
        onClick={primaryAction}
        className="h-12 gap-2 rounded-pill px-5 text-base"
      >
        <PrimaryIcon className={cn("h-[18px] w-[18px]", speaking && "animate-pulse")} strokeWidth={1.8} />
        {primaryLabel}
      </Button>

      {(hasSpoken || speaking || paused) && (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              narrator.replay();
              setHasSpoken(true);
            }}
            className="h-12 gap-2 rounded-pill px-4 text-base text-muted-foreground"
          >
            <RotateCcw className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="hidden sm:inline">{t("replay")}</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-12 gap-2 rounded-pill px-4 text-base text-muted-foreground"
                aria-label={t("speed")}
              >
                <Gauge className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="tabular-nums">{narrator.rate}×</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div className="px-1 pb-2 eyebrow">{t("speed")}</div>
              <div className="flex gap-1">
                {VOICE_RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => narrator.setRate(r)}
                    aria-pressed={narrator.rate === r}
                    className={cn(
                      "h-11 min-w-12 rounded-control px-3 text-sm font-semibold tabular-nums transition-colors",
                      narrator.rate === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}
      </div>
      {showLangHint && <p className="t-caption text-muted-foreground">{t("voiceLangHint")}</p>}
    </div>
  );
}
