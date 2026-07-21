/**
 * The short local record of what was pulled out of the platform.
 *
 * Deliberately localStorage and not a table: it answers "did I already export
 * this?" for the person sitting at the machine, which is a UI convenience, not
 * an audit trail. The audit trail is audit_logs.
 *
 * Lives here rather than inside the Export Center because Reports lists the
 * same records — two readers of one key needs one definition of the shape.
 */

export interface ExportRecord {
  format: "xlsx" | "pdf" | "doc";
  survey: string;
  count: number | null;
  at: string;
}

const HISTORY_KEY = "exportHistory";
const HISTORY_CAP = 8;

export function loadExportHistory(): ExportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as ExportRecord[]) : [];
  } catch {
    return [];
  }
}

export function pushExportHistory(record: ExportRecord): ExportRecord[] {
  const next = [record, ...loadExportHistory()].slice(0, HISTORY_CAP);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // A full or disabled store must never break the export that just succeeded.
  }
  return next;
}

export function exportRelTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
