import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

/**
 * The longitudinal half of the family workflow: scheduling a family to answer
 * the same instrument again, and minting the round when it falls due.
 *
 * The one rule everything here obeys: a round is a ROW, never an overwrite.
 * Each timepoint gets its own case, its own access token and its own response,
 * because the finding lives in the difference between them — writing round two
 * back over round one would delete the very quantity the study is measuring.
 * See 20260722180000_family_followups.sql for the schema this mirrors.
 */

/**
 * The generated Supabase types predate this migration, so the five followup_*
 * columns and the create_due_family_followups() RPC are invisible to the typed
 * client even though the database has them. One deliberately untyped handle,
 * confined to this file, keeps it compiling against reality; every row shape it
 * returns is declared explicitly below, so nothing here is loosely typed in
 * practice. The same reasoning (and the same handle) is already used in
 * lib/exportFamilies.ts — do not spread `as any` to the call sites instead.
 */
const db = supabase as unknown as SupabaseClient;

const DAY_MS = 86_400_000;

/**
 * A cycle in followup_parent_id is impossible through this module, but a bad
 * manual UPDATE could introduce one and an uncapped walk would then hang the
 * inspector forever. Twenty-four rounds is already two years of monthly
 * follow-up — well past any realistic study.
 */
const MAX_CHAIN_HOPS = 24;

export interface FollowUpPlan {
  /** null = one-off case, no schedule. */
  intervalDays: number | null;
  roundsTotal: number;
  round: number;
  parentId: string | null;
  dueAt: string | null;
}

/** The cadences a bereavement study actually uses, shortest first. */
export const FOLLOWUP_INTERVALS: { days: number; label: string }[] = [
  { days: 30, label: "Monthly" },
  { days: 90, label: "Every 3 months" },
  { days: 180, label: "Every 6 months" },
  { days: 365, label: "Yearly" },
];

export interface FollowUpChainEntry {
  id: string;
  reference_id: string;
  followup_round: number;
  status: string;
  completed_at: string | null;
}

/**
 * "This deployment has not run 20260722180000 yet."
 *
 * Three codes, because the same absence surfaces differently depending on what
 * was asked for: 42883 is Postgres's undefined_function and 42703 its
 * undefined_column, while PGRST202 is PostgREST failing to find the RPC in its
 * schema cache — which is what the browser client actually sees first, since the
 * request never reaches Postgres.
 */
function isMissingFollowUpSchema(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42883" || code === "42703" || code === "PGRST202";
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Lift the five schedule columns off a case row.
 *
 * Every field is defended, because a deployment that is behind on migrations
 * hands us rows without these columns at all — and the caseload page renders
 * before anyone notices the migration is missing. An absent schedule reads as
 * the honest default: a one-off baseline case.
 *
 * The parameter is widened to `| object` so a caller holding a declared row
 * type (FamilyCaseRow and friends) can pass it straight in: a TypeScript
 * interface has no index signature and so is not assignable to
 * Record<string, unknown>, and forcing every call site to cast would put the
 * unsafety in five files instead of one.
 */
export function readFollowUpPlan(row: Record<string, unknown> | object): FollowUpPlan {
  const source = row as Record<string, unknown>;
  const interval = source.followup_interval_days;
  return {
    intervalDays: interval == null ? null : asNumber(interval, 0) || null,
    roundsTotal: Math.max(1, asNumber(source.followup_rounds_total, 1)),
    round: Math.max(1, asNumber(source.followup_round, 1)),
    parentId: asString(source.followup_parent_id),
    dueAt: asString(source.followup_due_at),
  };
}

/**
 * The whole series for one family, oldest round first.
 *
 * Walks up to the baseline case and then forward again, because the caller
 * holds whichever round happens to be selected in the inspector and the useful
 * view is always the complete series, not the tail of it.
 */
export async function listFollowUpChain(caseId: string): Promise<FollowUpChainEntry[]> {
  const columns = "id, reference_id, followup_round, followup_parent_id, status, completed_at";

  interface ChainRow extends FollowUpChainEntry {
    followup_parent_id: string | null;
  }

  const fetchOne = async (id: string): Promise<ChainRow | null> => {
    const { data, error } = await db.from("family_cases").select(columns).eq("id", id).maybeSingle();
    // Unlike setFollowUpPlan, a missing column is not an error worth showing
    // here. This is a READ that decorates the inspector, and on a database that
    // has not run the migration the honest answer really is "this case is not
    // part of a series". Throwing would take the whole inspector down over a
    // panel the officer did not ask for. A write stays loud, because a silent
    // no-op there would let someone believe a schedule was saved.
    if (error) {
      if (isMissingFollowUpSchema(error)) return null;
      throw error;
    }
    return (data ?? null) as ChainRow | null;
  };

  const start = await fetchOne(caseId);
  if (!start) return [];

  // Up to the root. `seen` is what actually breaks a cycle; the hop cap is the
  // belt to its braces.
  const seen = new Set<string>([start.id]);
  let root = start;
  for (let hop = 0; hop < MAX_CHAIN_HOPS && root.followup_parent_id; hop++) {
    if (seen.has(root.followup_parent_id)) break;
    const parent = await fetchOne(root.followup_parent_id);
    if (!parent) break;
    seen.add(parent.id);
    root = parent;
  }

  // Down again. One child per parent is enforced by the sweep, so this is a
  // chain rather than a tree and a single-row lookup per hop is correct.
  const chain: ChainRow[] = [root];
  const walked = new Set<string>([root.id]);
  for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
    const current = chain[chain.length - 1];
    const { data, error } = await db
      .from("family_cases")
      .select(columns)
      .eq("followup_parent_id", current.id)
      .order("followup_round", { ascending: true })
      .limit(1);
    if (error) {
      if (isMissingFollowUpSchema(error)) break;
      throw error;
    }
    const child = ((data ?? [])[0] ?? null) as ChainRow | null;
    if (!child || walked.has(child.id)) break;
    walked.add(child.id);
    chain.push(child);
  }

  return chain
    .slice()
    .sort((a, b) => a.followup_round - b.followup_round)
    .map(({ id, reference_id, followup_round, status, completed_at }) => ({
      id,
      reference_id,
      followup_round,
      status,
      completed_at,
    }));
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Attach a schedule to a case, or clear one.
 *
 * The next round is counted from the moment this case was COMPLETED, not from
 * the moment an administrator happened to set the plan: "three months after
 * baseline" is a property of the family's timeline, not of the console. A case
 * that has not been submitted yet has no such anchor, so the clock starts now
 * and is superseded the next time the plan is touched.
 */
export async function setFollowUpPlan(
  caseId: string,
  plan: { intervalDays: number | null; roundsTotal: number },
): Promise<void> {
  const { data, error: readError } = await db
    .from("family_cases")
    .select("completed_at")
    .eq("id", caseId)
    .single();
  if (readError) throw readError;

  const completedAt = (data as { completed_at: string | null } | null)?.completed_at ?? null;
  const anchor = completedAt ? new Date(completedAt).getTime() : Date.now();
  // A NaN here would be serialised as JSON null and hit a NOT NULL violation on
  // a column the caller never meant to touch, so the fallback is the column's
  // own default rather than whatever arithmetic produced.
  const roundsTotal = Math.max(1, Math.round(asNumber(plan.roundsTotal, 1)));

  const intervalDays = plan.intervalDays != null && asNumber(plan.intervalDays, 0) > 0 ? Math.round(plan.intervalDays) : null;

  const dueAt =
    intervalDays != null
      ? new Date((Number.isFinite(anchor) ? anchor : Date.now()) + intervalDays * DAY_MS).toISOString()
      : null;

  const { error } = await db
    .from("family_cases")
    .update({
      followup_interval_days: intervalDays,
      followup_rounds_total: roundsTotal,
      followup_due_at: dueAt,
    })
    .eq("id", caseId);
  if (error) throw error;

  await recordEvent(caseId, "followup_plan_set", {
    interval_days: intervalDays,
    rounds_total: roundsTotal,
    due_at: dueAt,
  });
  await logAudit("family_case.followup_plan", "family_case", caseId, {
    interval_days: intervalDays,
    rounds_total: roundsTotal,
  });
}

/**
 * Mint every round that has fallen due and report how many were created.
 *
 * Swallows exactly one failure: the schema not existing. A deployment whose
 * database is behind on migrations still has a working caseload page, and an
 * officer who has never heard of follow-ups should not be shown a Postgres
 * error for a feature they are not using. Everything else — an authorisation
 * refusal above all — is a real failure and rethrows.
 */
export async function runDueFollowUps(): Promise<number> {
  const { data, error } = await db.rpc("create_due_family_followups");

  if (error) {
    if (isMissingFollowUpSchema(error)) return 0;
    throw error;
  }

  const created = typeof data === "number" ? data : Number(data ?? 0);
  if (created > 0) {
    await logAudit("family_case.followups_created", "family_case", undefined, { count: created });
  }
  return Number.isFinite(created) ? created : 0;
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
