import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, AlertCircle, Square, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createQuestion, QUESTION_KINDS, type QuestionKind, type SurveyQuestion } from "@/lib/surveys";
import { toast } from "sonner";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Status = "idle" | "listening" | "denied" | "unsupported" | "error";

export function VoiceDialog({
  open,
  onOpenChange,
  surveyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  surveyId: string;
  onCreated: (q: SurveyQuestion) => void;
}) {
  const [lang, setLang] = useState<"en-IN" | "te-IN">("en-IN");
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [kind, setKind] = useState<QuestionKind>("short_text");
  const [saving, setSaving] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!open) return;
    const Rec = getSpeechRecognition();
    if (!Rec) setStatus("unsupported");
    return () => { recRef.current?.stop(); };
  }, [open]);

  function start() {
    const Rec = getSpeechRecognition();
    if (!Rec) return setStatus("unsupported");
    const rec = new Rec();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setTranscript((prev) => (finalText ? `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${finalText}`.trim() : prev) + (interimText ? ` ${interimText}` : ""));
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") setStatus("denied");
      else setStatus("error");
    };
    rec.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
    recRef.current = rec;
    setTranscript("");
    setStatus("listening");
    rec.start();
  }

  function stop() {
    recRef.current?.stop();
    setStatus("idle");
  }

  function close(v: boolean) {
    if (!v) {
      recRef.current?.stop();
      setTranscript(""); setStatus("idle"); setKind("short_text");
    }
    onOpenChange(v);
  }

  async function handleSave() {
    if (!transcript.trim()) return toast.error("Record or type a question first.");
    setSaving(true);
    try {
      const q = await createQuestion(surveyId, kind, { origin: "voice", prompt_en: transcript.trim() });
      toast.success("Question added");
      onCreated(q);
      close(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mic className="h-4.5 w-4.5 text-primary" />Add question by voice</DialogTitle>
        </DialogHeader>

        {status === "unsupported" ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted grid place-items-center"><MicOff className="h-5 w-5 text-muted-foreground" /></div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Voice input isn't supported in this browser. Please try the latest Chrome or Edge, or type the question manually instead.
            </p>
          </div>
        ) : status === "denied" ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center"><MicOff className="h-5 w-5 text-destructive" /></div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Microphone access was denied. Allow microphone access for this site in your browser's address-bar settings, then try again.
            </p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setStatus("idle")}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Select value={lang} onValueChange={(v) => setLang(v as "en-IN" | "te-IN")} disabled={status === "listening"}>
                <SelectTrigger className="h-9 w-40 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-IN">English</SelectItem>
                  <SelectItem value="te-IN">తెలుగు (Telugu)</SelectItem>
                </SelectContent>
              </Select>

              {status === "listening" ? (
                <Button size="sm" variant="destructive" onClick={stop} className="rounded-lg">
                  <Square className="h-3.5 w-3.5 mr-1.5 fill-current" /> Stop
                </Button>
              ) : (
                <Button size="sm" onClick={start} className="rounded-lg">
                  <Mic className="h-3.5 w-3.5 mr-1.5" /> {transcript ? "Record again" : "Start recording"}
                </Button>
              )}
            </div>

            {status === "listening" && (
              <div className="flex items-center justify-center gap-1 h-8">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1 rounded-full bg-primary"
                    animate={{ height: [6, 22, 6] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                  />
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Something interrupted the recording. Please try again.
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">Transcript — edit before saving</div>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={3}
                placeholder="Speak, or type the question directly…"
                className="rounded-xl text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Question type</span>
              <Select value={kind} onValueChange={(v) => setKind(v as QuestionKind)}>
                <SelectTrigger className="h-8 w-auto rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {status !== "unsupported" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !transcript.trim()} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Save question
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
