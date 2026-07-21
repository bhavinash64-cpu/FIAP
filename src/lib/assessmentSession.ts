import type { AnswerValue, QuestionKind, SurveyQuestion } from "@/lib/surveys";

/** The stages of the guided assessment, in order. */
export type Stage = "welcome" | "consent" | "instructions" | "questions" | "review" | "done";

/**
 * What the platform knows about a single answer beyond its value.
 *
 * Every field here is observed, never inferred at read time: an export or an
 * analyst should be able to reconstruct what the respondent actually did — what
 * they saw, how long they sat with it, whether they moved past it deliberately,
 * whether they came back and changed their mind, whether they needed the
 * question read aloud.
 */
export interface AnswerMeta {
  /** The emoji shown beside the chosen option, when that scale had one. */
  emoji: string | null;
  /** Seconds this question was on screen, accumulated across every visit. */
  seconds: number;
  /** Moved past with the Skip control — distinct from simply never reached. */
  skipped: boolean;
  /** The answer was changed after one had already been given. */
  edited: boolean;
  /** Narration was played at least once while on this question. */
  voiceUsed: boolean;
  /** ISO timestamp of the most recent change to this answer. */
  answeredAt: string | null;
}

export function emptyMeta(): AnswerMeta {
  return { emoji: null, seconds: 0, skipped: false, edited: false, voiceUsed: false, answeredAt: null };
}

export interface SessionSnapshot {
  v: 1;
  answers: Record<string, AnswerValue>;
  /**
   * Optional rather than versioned: a draft written before per-answer metadata
   * existed is still a perfectly good draft, and a family mid-assessment should
   * not lose their answers to a schema bump. Absent simply means "no metadata
   * was captured for this session".
   */
  meta?: Record<string, AnswerMeta>;
  /** Index of the question the respondent was last on. */
  index: number;
  stage: Stage;
  consented: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface SubmissionRecord {
  v: 1;
  referenceId: string;
  submittedAt: string;
}

/**
 * Progress lives in localStorage, not on the server: a parent has no account to
 * key a server-side draft to, and asking for one to save a half-finished
 * well-being questionnaire would be the wrong trade. The cost is that resume is
 * per-device, which the welcome screen says plainly.
 */
const sessionKey = (surveyId: string) => `assessment:${surveyId}:v1`;
const submissionKey = (surveyId: string) => `assessment:${surveyId}:submitted:v1`;

/** Abandoned drafts shouldn't resurface months later as a stale "welcome back". */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function loadSession(surveyId: string): SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(surveyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (parsed?.v !== 1 || typeof parsed.answers !== "object" || parsed.answers === null) return null;
    if (Date.now() - new Date(parsed.updatedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(sessionKey(surveyId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(surveyId: string, snapshot: Omit<SessionSnapshot, "v" | "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    const payload: SessionSnapshot = { ...snapshot, v: 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(sessionKey(surveyId), JSON.stringify(payload));
  } catch {
    // A full or disabled store must never break the assessment; the respondent
    // simply loses resume, which the next save may well restore.
  }
}

export function clearSession(surveyId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(sessionKey(surveyId));
  } catch {
    /* ignore */
  }
}

export function loadSubmission(surveyId: string): SubmissionRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(submissionKey(surveyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubmissionRecord;
    if (parsed?.v !== 1) return null;
    // The record prevents a duplicate submit, but it must not pin a shared or
    // family device to the Thank-You screen forever — after MAX_AGE it expires,
    // so a later republish/retake is possible.
    if (Date.now() - new Date(parsed.submittedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(submissionKey(surveyId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSubmission(surveyId: string, record: Omit<SubmissionRecord, "v">) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(submissionKey(surveyId), JSON.stringify({ ...record, v: 1 }));
  } catch {
    /* ignore */
  }
}

export function clearSubmission(surveyId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(submissionKey(surveyId));
  } catch {
    /* ignore */
  }
}

// ── Answers ────────────────────────────────────────────────────────────────

export function isAnswered(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function countAnswered(questions: SurveyQuestion[], answers: Record<string, AnswerValue>): number {
  return questions.reduce((n, q) => n + (isAnswered(answers[q.id]) ? 1 : 0), 0);
}

/** First question with no answer, or -1 when the set is complete. */
export function firstUnansweredIndex(questions: SurveyQuestion[], answers: Record<string, AnswerValue>): number {
  return questions.findIndex((q) => !isAnswered(answers[q.id]));
}

/** Every question still without an answer, with its position, for the review list. */
export function unansweredQuestions(
  questions: SurveyQuestion[],
  answers: Record<string, AnswerValue>,
): { question: SurveyQuestion; index: number }[] {
  return questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => !isAnswered(answers[question.id]));
}

/** 0–1. The share of the instrument the respondent actually answered. */
export function completionRatio(questions: SurveyQuestion[], answers: Record<string, AnswerValue>): number {
  if (!questions.length) return 0;
  return countAnswered(questions, answers) / questions.length;
}

// ── Time estimate ──────────────────────────────────────────────────────────

/**
 * Seconds per question by type — read, decide, tap. Deliberately unhurried:
 * an estimate that runs short makes a long questionnaire feel like it is
 * getting longer as you answer it, which is precisely the wrong feeling here.
 */
const SECONDS_BY_KIND: Record<QuestionKind, number> = {
  likert5: 10,
  multiple_choice: 12,
  dropdown: 12,
  yes_no: 8,
  rating5: 10,
  checkboxes: 16,
  short_text: 28,
  long_text: 50,
};

export function estimateSeconds(questions: SurveyQuestion[]): number {
  return questions.reduce((s, q) => s + (SECONDS_BY_KIND[q.kind] ?? 12), 0);
}

/** Remaining time for questions from `fromIndex` on that still have no answer. */
export function remainingSeconds(
  questions: SurveyQuestion[],
  answers: Record<string, AnswerValue>,
  fromIndex: number,
): number {
  return questions
    .slice(Math.max(0, fromIndex))
    .filter((q) => !isAnswered(answers[q.id]))
    .reduce((s, q) => s + (SECONDS_BY_KIND[q.kind] ?? 12), 0);
}

export function minutesFromSeconds(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * A reference the respondent can read over a phone line. The response uuid is
 * the source, so this stays traceable back to the row without exposing the
 * whole id.
 */
export function formatReferenceId(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
