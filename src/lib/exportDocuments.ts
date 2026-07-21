/**
 * Document exports — the PDF and Word halves of the export system.
 *
 * Excel lives in exportExcel.ts / exportFamilies.ts and is not duplicated here.
 * This module knows about two things only: report metadata and tables of cells.
 * It has no idea that surveys, families or Supabase exist, which is precisely
 * what lets Responses, Reports and any future page share one document look.
 *
 * Two format decisions are forced by the fact that most respondents answer in
 * Telugu, and both are deliberate — see the comments on buildReportHtml and
 * exportPdfDocument before changing either.
 */

import { downloadBlob } from "@/lib/exportExcel";
import { printSheetOnly } from "@/lib/share";

export interface ReportMeta {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  filters?: { label: string; value: string }[];
  rowCount: number;
}

export interface ReportTable {
  caption?: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null>[];
}

/** Past this many columns a page turns landscape and the type drops to ~8pt. */
const LANDSCAPE_COLUMN_THRESHOLD = 12;

/**
 * Past this many columns no page geometry saves the reader: a wide answer
 * matrix is a spreadsheet, not a document. Callers are expected to check with
 * isTooWideForDocument() and offer the Excel export instead.
 */
export const MAX_DOCUMENT_COLUMNS = 24;

const PRODUCT_NAME = "Jeevana Insight";
const ORG_LINE = "Family Assessment Research Platform";
const CONFIDENTIAL_NOTE =
  "Confidential research data. Handle, store and dispose of this file in line with the study's data protection protocol.";
const EMPTY_CELL = "—";

/**
 * Nirmala UI is the Telugu font shipped with Windows and the one Word will
 * reach for; Noto Sans Telugu covers Linux and any machine with the Google
 * fonts installed. A Latin fallback trails it so English reports do not render
 * in a Telugu face.
 */
const DOC_FONT_STACK =
  '"Nirmala UI", "Noto Sans Telugu", Gautami, "Segoe UI", Calibri, Arial, sans-serif';

/**
 * User-entered field data (family names, free-text answers) is treated as
 * hostile: a single unescaped `<` or `&` would corrupt the printed sheet and,
 * worse, the .doc file that leaves the building. Every interpolated value in
 * this module goes through here.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCellForDocument(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_CELL;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? EMPTY_CELL : value.toLocaleString();
  // NaN / Infinity reach a report only through a division by zero upstream;
  // printing "NaN" in a research artefact reads as a data error rather than as
  // the missing value it actually is.
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : EMPTY_CELL;
  return String(value);
}

/** Widest table in the set — decides page orientation and the column guard. */
function widestColumnCount(tables: ReportTable[]): number {
  return tables.reduce((max, t) => Math.max(max, t.columns.length), 0);
}

/**
 * True when a table set is too wide to be a document at all. Callers should
 * check this before offering a PDF or Word button and fall back to Excel.
 */
export function isTooWideForDocument(tables: ReportTable[]): boolean {
  return widestColumnCount(tables) > MAX_DOCUMENT_COLUMNS;
}

function assertRenderable(tables: ReportTable[]): void {
  if (isTooWideForDocument(tables)) {
    throw new Error(
      `This report has ${widestColumnCount(tables)} columns; documents are capped at ${MAX_DOCUMENT_COLUMNS}. Export it as Excel instead.`,
    );
  }
}

function metaRows(meta: ReportMeta): { label: string; value: string }[] {
  const rows = [
    { label: "Generated", value: meta.generatedAt.toLocaleString() },
    { label: "Records", value: String(meta.rowCount) },
  ];
  for (const f of meta.filters ?? []) rows.push({ label: f.label, value: f.value });
  return rows;
}

function renderMetaTable(meta: ReportMeta): string {
  const rows = metaRows(meta)
    .map(
      (r) =>
        `<tr><th scope="row" class="jv-meta-key">${escapeHtml(r.label)}</th><td class="jv-meta-val">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("");
  return `<table class="jv-meta"><tbody>${rows}</tbody></table>`;
}

function renderTable(table: ReportTable): string {
  const head = table.columns
    .map(
      (c) =>
        `<th scope="col"${c.align === "right" ? ' style="text-align:right"' : ""}>${escapeHtml(c.label)}</th>`,
    )
    .join("");

  const body = table.rows.length
    ? table.rows
        .map((row) => {
          const cells = table.columns
            .map((c) => {
              const text = escapeHtml(formatCellForDocument(row[c.key]));
              return `<td${c.align === "right" ? ' style="text-align:right"' : ""}>${text}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("")
    : `<tr><td class="jv-empty" colspan="${table.columns.length}">No records match the applied filters.</td></tr>`;

  const caption = table.caption ? `<p class="jv-table-title">${escapeHtml(table.caption)}</p>` : "";

  // <thead> is a real element rather than a styled first row because that is
  // what both the print pipeline and Word use to repeat the header across pages.
  return `${caption}<table class="jv-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * The paper stylesheet.
 *
 * Deliberately built from raw hex, pt units and element selectors: this markup
 * leaves the app — it is printed by the browser's print engine or opened in
 * Word — where none of the design tokens in index.css exist. This is the one
 * place in the codebase where the design system does not apply.
 */
function reportStyles(landscape: boolean, forWord: boolean): string {
  const bodySize = landscape ? "8pt" : "10pt";
  const tableSize = landscape ? "7.5pt" : "9.5pt";
  const page = landscape ? "@page { size: A4 landscape; margin: 1.4cm; }" : "@page { size: A4; margin: 2cm; }";

  // The PDF path mounts this into the live app, so the sheet must stay invisible
  // on screen and appear only for the print job. Word never sees these rules.
  const screenHiding = forWord
    ? ""
    : `.jv-doc { display: none; }
  @media print { .jv-doc { display: block; } }`;

  return `<style>
  ${page}
  ${screenHiding}
  .jv-doc { font-family: ${DOC_FONT_STACK}; font-size: ${bodySize}; line-height: 1.45; color: #000000; background: #ffffff; }
  .jv-doc p, .jv-doc h1, .jv-doc h2, .jv-doc table { margin: 0; }
  .jv-head { border-bottom: 1pt solid #000000; padding-bottom: 6pt; margin-bottom: 10pt; }
  .jv-brand { font-size: 12pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .jv-org { font-size: 8.5pt; letter-spacing: 0.04em; color: #333333; margin-top: 1pt; }
  .jv-title { font-size: 15pt; font-weight: 700; margin-top: 10pt; }
  .jv-subtitle { font-size: 10pt; color: #333333; margin-top: 2pt; }
  .jv-meta { border-collapse: collapse; margin-top: 8pt; }
  .jv-meta-key { text-align: left; font-weight: 700; padding: 1.5pt 14pt 1.5pt 0; white-space: nowrap; vertical-align: top; }
  .jv-meta-val { padding: 1.5pt 0; vertical-align: top; }
  .jv-table-title { font-size: 11pt; font-weight: 700; margin-top: 14pt; margin-bottom: 4pt; }
  .jv-table { width: 100%; border-collapse: collapse; font-size: ${tableSize}; margin-top: 6pt; ${landscape ? "table-layout: fixed; word-wrap: break-word;" : ""} }
  .jv-table th { background: #ececec; border: 0.5pt solid #808080; padding: 3.5pt 5pt; text-align: left; font-weight: 700; vertical-align: bottom; }
  .jv-table td { border: 0.5pt solid #bfbfbf; padding: 3.5pt 5pt; text-align: left; vertical-align: top; }
  .jv-table thead { display: table-header-group; }
  .jv-table tr { page-break-inside: avoid; }
  .jv-empty { text-align: center; color: #555555; font-style: italic; }
  .jv-foot { margin-top: 14pt; padding-top: 5pt; border-top: 0.5pt solid #808080; font-size: 8pt; color: #333333; }
</style>`;
}

/**
 * The single HTML generator both document formats share. One implementation is
 * the entire reason PDF and Word live in one module: they cannot drift apart.
 *
 * Wide tables (more than LANDSCAPE_COLUMN_THRESHOLD columns) flip the page to
 * landscape and shrink the type; anything wider than MAX_DOCUMENT_COLUMNS is
 * rejected by the exporters rather than rendered illegibly.
 */
export function buildReportHtml(
  meta: ReportMeta,
  tables: ReportTable[],
  opts?: { forWord?: boolean },
): string {
  const forWord = opts?.forWord === true;
  const landscape = widestColumnCount(tables) > LANDSCAPE_COLUMN_THRESHOLD;

  const header = [
    `<div class="jv-brand">${escapeHtml(PRODUCT_NAME)}</div>`,
    `<div class="jv-org">${escapeHtml(ORG_LINE)}</div>`,
    `<h1 class="jv-title">${escapeHtml(meta.title)}</h1>`,
    meta.subtitle ? `<p class="jv-subtitle">${escapeHtml(meta.subtitle)}</p>` : "",
    renderMetaTable(meta),
  ].join("");

  const body = tables.map(renderTable).join("");

  return `${reportStyles(landscape, forWord)}
<div class="jv-doc">
  <header class="jv-head">${header}</header>
  ${body}
  <p class="jv-foot">${escapeHtml(CONFIDENTIAL_NOTE)}</p>
</div>`;
}

/**
 * Word export — a Word-compatible HTML document saved as .doc, not a .docx.
 *
 * Word opens an HTML document carrying the MSO namespace natively and keeps
 * tables, headings and Unicode intact, rendering Telugu with the system font.
 * Generating a real .docx would pull in the ~500kB `docx` package to produce a
 * file Word treats identically for this content. Do not "upgrade" this.
 */
export function exportWordDocument(meta: ReportMeta, tables: ReportTable[], fileName: string): void {
  assertRenderable(tables);

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="${escapeHtml(PRODUCT_NAME)}">
<title>${escapeHtml(meta.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
</head>
<body>
${buildReportHtml(meta, tables, { forWord: true })}
</body>
</html>`;

  // The BOM is what makes Word commit to UTF-8 on open; without it some Word
  // builds fall back to the system codepage and every Telugu answer turns to
  // mojibake, <meta charset> notwithstanding.
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  downloadBlob(blob, fileName.toLowerCase().endsWith(".doc") ? fileName : `${fileName}.doc`);
}

/**
 * PDF export — through the browser's print pipeline, never a JS PDF library.
 *
 * jsPDF and pdfmake ship Latin-only core fonts. Telugu comes out as tofu or
 * with reordered glyphs unless a ~400kB Noto Sans Telugu subset is embedded and
 * a shaping engine wired up, and even then conjuncts break. The browser already
 * has correct Telugu shaping and the user's own font, so a styled print sheet
 * saved as PDF from the print dialog is BETTER output than a JS library can
 * produce here, not a compromise. Anyone tempted to "upgrade" this to jsPDF
 * would silently break every Telugu report.
 *
 * Resolves once the mounted sheet has been torn down.
 */
export function exportPdfDocument(meta: ReportMeta, tables: ReportTable[]): Promise<void> {
  assertRenderable(tables);
  if (typeof document === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const host = document.createElement("div");
    // Same class set as <PrintSheet>: `print-sheet` is what the single rule in
    // index.css keys off to hide the rest of the app, and hidden/print:block
    // keeps the sheet off the screen while it waits for the dialog.
    host.className = "print-sheet hidden bg-white text-black print:block";
    host.innerHTML = buildReportHtml(meta, tables);
    document.body.appendChild(host);

    let torndown = false;
    let timer = 0;

    const teardown = () => {
      if (torndown) return;
      torndown = true;
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
      host.remove();
      resolve();
    };

    // printSheetOnly() owns the body class and its own afterprint cleanup; this
    // node is ours to remove. The timer is not a fallback for slow printing —
    // Safari has never reliably fired afterprint, and a sheet left in the DOM
    // would poison the next Ctrl+P.
    const onAfterPrint = () => window.setTimeout(teardown, 300);
    window.addEventListener("afterprint", onAfterPrint);
    timer = window.setTimeout(teardown, 60_000);

    // Two frames so the injected markup is laid out and its fonts resolved
    // before the modal print dialog freezes the page.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => printSheetOnly());
    });
  });
}
