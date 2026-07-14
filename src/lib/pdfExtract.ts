export interface PdfTextResult {
  text: string;
  pageCount: number;
  charsExtracted: number;
}

const MAX_PAGES = 60;

let workerConfigured = false;

// pdfjs-dist is a large dependency only needed when the admin actually opens
// the PDF import dialog — dynamically imported here so it never inflates the
// initial dashboard bundle.
export async function extractPdfText(file: File, onProgress?: (page: number, total: number) => void): Promise<PdfTextResult> {
  const [pdfjsLib, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    workerConfigured = true;
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageCount = doc.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PAGES);
  const parts: string[] = [];

  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    parts.push(pageText);
    onProgress?.(i, pagesToRead);
  }

  const text = parts.join("\n").replace(/[ \t]+/g, " ").trim();
  return { text, pageCount, charsExtracted: text.length };
}
