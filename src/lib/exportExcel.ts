import type { Survey, SurveyQuestion } from "@/lib/surveys";
import type { ExportResponseRow } from "@/lib/analytics";

const HEADER_FILL = "FF122A54"; // matches the app's deep navy primary
const HEADER_FONT = "FFFFFFFF";

// exceljs is a large dependency only needed when an export is actually
// requested — dynamically imported here so it never inflates the initial
// dashboard bundle.
export async function buildResponsesWorkbook(survey: Survey, questions: SurveyQuestion[], rows: ExportResponseRow[]): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "AP Police Family Assessment Platform";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Responses", { views: [{ state: "frozen", ySplit: 1 }] });

  const headers = ["Submitted at", "Language", ...questions.map((q) => q.prompt_en)];
  sheet.columns = headers.map((h, i) => ({
    header: h,
    key: i === 0 ? "submitted" : i === 1 ? "language" : questions[i - 2].id,
    width: Math.min(60, Math.max(14, h.length + 4)),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  headerRow.height = 22;

  for (const r of rows) {
    const rowValues: Record<string, string> = {
      submitted: new Date(r.submittedAt).toLocaleString(),
      language: r.language === "te" ? "Telugu" : "English",
    };
    for (const q of questions) rowValues[q.id] = r.answers[q.id] ?? "";
    sheet.addRow(rowValues);
  }

  // Widen columns to fit their longest cell, capped so the sheet stays readable.
  sheet.columns.forEach((col) => {
    let max = String(col.header ?? "").length;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(60, Math.max(14, max + 2));
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "survey";
}
