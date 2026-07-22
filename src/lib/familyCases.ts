import { customAlphabet } from "nanoid";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import type { FamilyCaseStatus } from "@/lib/familyAccess";

/**
 * The administrator's half of the family workflow: creating cases, minting the
 * credentials that go on a printed slip, and watching them come back.
 *
 * All of this is ordinary RLS-protected table access — every function here runs
 * as an authenticated super admin. The respondent's side (lib/familyAccess.ts)
 * shares none of it, and cannot.
 */

export type { FamilyCaseStatus };


export interface FamilyCase {
  id: string;
  reference_id: string;
  deceased_name: string;
  family_head_name: string;
  relationship: string;
  phone: string;
  district: string;
  village: string | null;
  preferred_language: "en" | "te";
  notes: string | null;
  survey_id: string;
  status: FamilyCaseStatus;
  access_token: string;
  /** Retired credential. NULL on every case created after 2026-07-22. */
  pin: string | null;
  pin_issued_at: string;
  locked_until: string | null;
  expires_at: string;
  opened_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  response_id: string | null;
  draft_updated_at: string | null;
  officer_id: string | null;
  officer_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyCaseRow extends FamilyCase {
  survey_title_en: string;
  survey_title_te: string | null;
  /** Server-computed at submission — not recalculated from answers on read. */
  completion_pct: number | null;
  submitted_at: string | null;
}

export interface FamilyCaseEvent {
  id: string;
  case_id: string;
  event: string;
  detail: Record<string, unknown>;
  actor: string;
  created_at: string;
}

export interface FamilyCaseInput {
  deceased_name: string;
  family_head_name: string;
  relationship: string;
  phone: string;
  district: string;
  village?: string;
  preferred_language: "en" | "te";
  survey_id: string;
  notes?: string;
  /** Days the credentials stay valid. Defaults to 90. */
  valid_days?: number;
}

/** The relationships a field officer actually records, in the order they occur. */
export const RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Guardian",
  "Other",
] as const;

export const CASE_STATUSES: FamilyCaseStatus[] = [
  "not_started",
  "opened",
  "in_progress",
  "completed",
  "expired",
  "reopened",
];

/** Unambiguous alphabet — no 0/o/1/l — because these get read aloud and retyped. */
const genToken = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 22);

/** Strips +91 / leading 0 / spacing so lookups and uniqueness are on one form. */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(raw));
}

/** The address that goes on the slip and inside the QR code. */
export function familyLinkUrl(accessToken: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/family/${accessToken}`;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * One page of the module in two round trips.
 *
 * The expiry sweep runs first so a case that lapsed overnight is already shown
 * as Expired rather than as a stale "In progress" an officer might chase.
 */
export async function listFamilyCases(): Promise<FamilyCaseRow[]> {
  await supabase.rpc("expire_stale_family_cases");

  const [{ data: cases, error }, { data: surveys }] = await Promise.all([
    supabase.from("family_cases").select("*").order("created_at", { ascending: false }),
    supabase.from("surveys").select("id, title_en, title_te"),
  ]);
  if (error) throw error;

  const rows = (cases ?? []) as unknown as FamilyCase[];
  const surveyRows = (surveys ?? []) as Array<{ id: string; title_en: string; title_te: string | null }>;
  const titles = new Map(surveyRows.map((s) => [s.id, s]));

  const responseIds = rows.map((c) => c.response_id).filter((id): id is string => !!id);
  const responses = new Map<string, { completion_pct: number | null; submitted_at: string }>();
  if (responseIds.length) {
    const { data } = await supabase
      .from("survey_responses")
      .select("id, completion_pct, submitted_at")
      .in("id", responseIds);
    for (const r of data ?? []) {
      responses.set(r.id, { completion_pct: r.completion_pct, submitted_at: r.submitted_at });
    }
  }

  return rows.map((c) => {
    const survey = titles.get(c.survey_id);
    const response = c.response_id ? responses.get(c.response_id) : undefined;
    return {
      ...c,
      survey_title_en: survey?.title_en ?? "—",
      survey_title_te: survey?.title_te ?? null,
      completion_pct: response?.completion_pct ?? null,
      submitted_at: response?.submitted_at ?? null,
    };
  });
}

export async function getFamilyCaseEvents(caseId: string): Promise<FamilyCaseEvent[]> {
  const { data, error } = await supabase
    .from("family_case_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FamilyCaseEvent[];
}

export interface FamilyCaseStats {
  total: number;
  notStarted: number;
  opened: number;
  inProgress: number;
  completed: number;
  expired: number;
  completedToday: number;
  avgCompletionSeconds: number | null;
}

export async function getFamilyCaseStats(): Promise<FamilyCaseStats> {
  const { data, error } = await supabase.rpc("family_case_stats");
  if (error) throw error;
  const row = (data?.[0] ?? {}) as Record<string, number | null>;
  return {
    total: Number(row.total ?? 0),
    notStarted: Number(row.not_started ?? 0),
    opened: Number(row.opened ?? 0),
    inProgress: Number(row.in_progress ?? 0),
    completed: Number(row.completed ?? 0),
    expired: Number(row.expired ?? 0),
    completedToday: Number(row.completed_today ?? 0),
    avgCompletionSeconds: row.avg_completion_seconds != null ? Number(row.avg_completion_seconds) : null,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Create a case and mint its credentials in one step — an officer standing in
 * a family's front room should get a printable slip from one action, not a
 * create-then-generate sequence they can half-finish.
 *
 * Login resolves a (phone, PIN) pair with no case id, so the database holds a
 * unique index on that pair. A collision is a ~1-in-10^6 event per repeat
 * number, and the retry loop turns it into a non-event.
 */
export async function createFamilyCase(input: FamilyCaseInput): Promise<FamilyCase> {
  const { data: auth } = await supabase.auth.getUser();
  const phone = normalisePhone(input.phone);
  const expiresAt = new Date(Date.now() + (input.valid_days ?? 90) * 86_400_000).toISOString();

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await supabase
      .from("family_cases")
      .insert({
        deceased_name: input.deceased_name.trim(),
        family_head_name: input.family_head_name.trim(),
        relationship: input.relationship,
        phone,
        district: input.district.trim(),
        village: input.village?.trim() || null,
        preferred_language: input.preferred_language,
        notes: input.notes?.trim() || null,
        survey_id: input.survey_id,
        access_token: genToken(),
        expires_at: expiresAt,
        officer_id: auth.user?.id ?? null,
        officer_name: auth.user?.email ?? null,
      })
      .select("*")
      .single();

    if (!error) {
      const created = data as unknown as FamilyCase;
      await recordEvent(created.id, "created", { officer: auth.user?.email });
      await logAudit("family_case.create", "family_case", created.id, {
        reference_id: created.reference_id,
        survey_id: input.survey_id,
      });
      return created;
    }

    // Only a token/PIN collision is worth retrying — anything else is a real
    // failure and should surface immediately rather than after six attempts.
    if (!/duplicate key|unique/i.test(error.message)) throw error;
  }

  throw new Error("Could not generate unique credentials. Please try again.");
}

export async function updateFamilyCase(
  id: string,
  patch: Partial<
    Pick<
      FamilyCase,
      | "deceased_name"
      | "family_head_name"
      | "relationship"
      | "phone"
      | "district"
      | "village"
      | "preferred_language"
      | "notes"
      | "survey_id"
    >
  >,
): Promise<void> {
  const next = { ...patch };
  if (next.phone) next.phone = normalisePhone(next.phone);
  const { error } = await supabase.from("family_cases").update(next).eq("id", id);
  if (error) throw error;
  await recordEvent(id, "updated", { fields: Object.keys(patch) });
  await logAudit("family_case.update", "family_case", id, { fields: Object.keys(patch) });
}

/**
 * Mint a new link and kill every session opened under the old one. This is the
 * action for "the slip was lost" or "the QR was photographed by the wrong
 * person" — the previous URL must stop working the instant it is pressed.
 */
export async function regenerateLink(id: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const token = genToken();
    const { error } = await supabase.from("family_cases").update({ access_token: token }).eq("id", id);
    if (!error) {
      await recordEvent(id, "link_regenerated", {});
      await logAudit("family_case.link_regenerate", "family_case", id, {});
      return token;
    }
    if (!/duplicate key|unique/i.test(error.message)) throw error;
  }
  throw new Error("Could not generate a unique link. Please try again.");
}

/** Push the expiry out without touching the credentials the family already holds. */
export async function extendFamilyCase(id: string, days = 30): Promise<string> {
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("family_cases")
    .update({ expires_at: expiresAt, status: "opened" })
    .eq("id", id)
    .select("status")
    .single();
  if (error) throw error;
  await recordEvent(id, "extended", { days });
  await logAudit("family_case.extend", "family_case", id, { days });
  return (data as { status: string }).status;
}

/**
 * Reopen a submitted case.
 *
 * The existing response is left exactly where it is: a completed assessment is
 * research data, and a second sitting must add a second row rather than quietly
 * rewrite the first. The case simply becomes answerable again.
 */
export async function reopenFamilyCase(id: string, days = 30): Promise<void> {
  const { error } = await supabase
    .from("family_cases")
    .update({
      status: "reopened",
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      completed_at: null,
      response_id: null,
      draft: null,
      draft_updated_at: null,
    })
    .eq("id", id);
  if (error) throw error;
  await recordEvent(id, "reopened", { days });
  await logAudit("family_case.reopen", "family_case", id, {});
}

export async function deleteFamilyCase(id: string): Promise<void> {
  const { error } = await supabase.from("family_cases").delete().eq("id", id);
  if (error) throw error;
  await logAudit("family_case.delete", "family_case", id, {});
}

async function recordEvent(caseId: string, event: string, detail: Record<string, unknown>) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("family_case_events").insert({
    case_id: caseId,
    event,
    detail: detail as never,
    actor: auth.user?.email ?? "admin",
  });
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

export function formatPhone(phone: string): string {
  const d = normalisePhone(phone);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : phone;
}


export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** Filesystem-safe stem for a case's QR download. */
export function caseQrFileName(referenceId: string, familyHead: string): string {
  const stem = familyHead
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `qr-${referenceId}${stem ? `-${stem}` : ""}`;
}
