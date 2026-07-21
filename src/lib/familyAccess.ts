import { supabase } from "@/integrations/supabase/client";
import type { AnswerValue, Survey, SurveyQuestion } from "@/lib/surveys";
import type { AnswerMeta, Stage } from "@/lib/assessmentSession";

/**
 * The respondent's half of the platform.
 *
 * Every function here calls exactly one edge function, `family-access`, which
 * is the only door a family has. The browser holds an opaque session token and
 * nothing else — no Supabase auth session, no anon table access, no survey id
 * it could swap. That is deliberate: the guarantee "a family can only reach
 * their own assessment" is enforced on the server, and this module simply has
 * no way to ask for anything more.
 */

const FN = "family-access";

export type FamilyCaseStatus =
  | "not_started"
  | "opened"
  | "in_progress"
  | "completed"
  | "expired"
  | "reopened";

/** The only shape of a case a respondent's browser ever sees. */
export interface RespondentCase {
  referenceId: string;
  familyHead: string;
  /** Last four digits only — a memory jog for the family, useless to a stranger. */
  phoneHint: string;
  language: "en" | "te";
  status: FamilyCaseStatus;
  expiresAt: string;
}

export interface RespondentDraft {
  answers: Record<string, AnswerValue>;
  meta?: Record<string, AnswerMeta>;
  index: number;
  stage: Stage;
  startedAt: string;
}

export interface SubmissionReceipt {
  referenceId: string;
  assessmentId: string;
  submittedAt: string;
  completionPct: number;
  answeredCount?: number;
  skippedCount?: number;
  alreadySubmitted?: boolean;
}

export interface AssessmentBundle {
  case: RespondentCase;
  survey: Survey | null;
  questions: SurveyQuestion[];
  draft: RespondentDraft | null;
  submission: SubmissionReceipt | null;
}

/** What a QR code or secure link may reveal before the PIN is entered. */
export type LinkResolution =
  | { state: "not_found" }
  | { state: "expired" }
  | {
      state: "ok";
      case: Pick<RespondentCase, "referenceId" | "familyHead" | "phoneHint" | "language" | "status">;
      survey: { titleEn: string; titleTe: string | null };
    };

/**
 * Every failure the login screen must be able to say something calm about.
 * `invalid_credentials` covers both a wrong phone and a wrong PIN on purpose —
 * telling them apart would let someone enumerate which families are enrolled.
 */
export type FamilyAccessErrorCode =
  | "invalid_credentials"
  | "locked"
  | "expired"
  | "too_many_attempts"
  | "no_session"
  | "session_expired"
  | "already_submitted"
  | "network"
  | "unknown";

export class FamilyAccessError extends Error {
  code: FamilyAccessErrorCode;
  retryAt?: string;
  constructor(code: FamilyAccessErrorCode, retryAt?: string) {
    super(code);
    this.name = "FamilyAccessError";
    this.code = code;
    this.retryAt = retryAt;
  }
}

const KNOWN_CODES: FamilyAccessErrorCode[] = [
  "invalid_credentials",
  "locked",
  "expired",
  "too_many_attempts",
  "no_session",
  "session_expired",
  "already_submitted",
];

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body });

  // supabase-js surfaces a non-2xx as a FunctionsHttpError whose body carries
  // our error code — read it, because "locked" and "expired" need entirely
  // different screens from a generic failure.
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = (await ctx.json()) as { error?: string; retryAt?: string };
        if (payload?.error && KNOWN_CODES.includes(payload.error as FamilyAccessErrorCode)) {
          throw new FamilyAccessError(payload.error as FamilyAccessErrorCode, payload.retryAt);
        }
      } catch (e) {
        if (e instanceof FamilyAccessError) throw e;
      }
    }
    throw new FamilyAccessError("network");
  }

  const payload = data as { error?: string; retryAt?: string };
  if (payload?.error) {
    const code = KNOWN_CODES.includes(payload.error as FamilyAccessErrorCode)
      ? (payload.error as FamilyAccessErrorCode)
      : "unknown";
    throw new FamilyAccessError(code, payload.retryAt);
  }
  return data as T;
}

// ── Session storage ────────────────────────────────────────────────────────

/**
 * localStorage, not sessionStorage: a family assessment is routinely finished
 * across sittings and sometimes after the phone has been locked and reopened,
 * and being thrown back to a PIN screen mid-instrument is exactly the friction
 * this workflow exists to remove. The token is revoked server-side the moment
 * the assessment is submitted, so a shared handset can't be reopened into it.
 */
const SESSION_KEY = "family:session:v1";

interface StoredSession {
  token: string;
  expiresAt: string;
}

export function loadRespondentSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function saveRespondentSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* A full or disabled store must never block a family from answering. */
  }
}

export function clearRespondentSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function hasRespondentSession(): boolean {
  return loadRespondentSession() !== null;
}

// ── Actions ────────────────────────────────────────────────────────────────

export function resolveFamilyLink(token: string): Promise<LinkResolution> {
  return call<LinkResolution>({ action: "resolve", token });
}

export async function familyLogin(input: {
  phone: string;
  pin: string;
  token?: string;
}): Promise<AssessmentBundle> {
  const result = await call<AssessmentBundle & { session: StoredSession }>({
    action: "login",
    phone: input.phone,
    pin: input.pin,
    token: input.token ?? "",
  });
  saveRespondentSession(result.session);
  return result;
}

export function resumeFamilySession(): Promise<AssessmentBundle> {
  const session = loadRespondentSession();
  if (!session) return Promise.reject(new FamilyAccessError("no_session"));
  return call<AssessmentBundle>({ action: "resume", session });
}

/**
 * Server-side autosave. Fire-and-forget by design: the local snapshot has
 * already been written synchronously by the caller, so a failed sync costs the
 * family nothing except cross-device resume, which the next save restores.
 */
export async function saveFamilyDraft(draft: RespondentDraft): Promise<boolean> {
  const session = loadRespondentSession();
  if (!session) return false;
  try {
    await call({ action: "save", session, draft });
    return true;
  } catch {
    return false;
  }
}

export async function submitFamilyAssessment(input: {
  answers: Record<string, AnswerValue>;
  meta: Record<string, AnswerMeta>;
  language: string;
  startedAt?: string;
}): Promise<SubmissionReceipt> {
  const session = loadRespondentSession();
  if (!session) throw new FamilyAccessError("no_session");
  return call<SubmissionReceipt>({
    action: "submit",
    session,
    answers: input.answers,
    meta: input.meta,
    language: input.language,
    startedAt: input.startedAt,
  });
}

export async function familySignOut(): Promise<void> {
  const session = loadRespondentSession();
  clearRespondentSession();
  if (!session) return;
  try {
    await call({ action: "signout", session });
  } catch {
    // The local token is already gone; a failed server revoke is not something
    // to make a family look at an error about.
  }
}
