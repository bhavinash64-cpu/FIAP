/**
 * Headless capture + overflow diagnostics via the system Chrome.
 *   node scripts/shot.mjs <url> <outDir> <w1,w2,...>
 * Reports, per width: documentElement.scrollWidth vs innerWidth, and the
 * offending elements wider than the viewport (the usual cause of a horizontal
 * scrollbar). Also writes a full-page PNG per width.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const [url, outDir, widthsArg] = process.argv.slice(2);
const widths = (widthsArg ?? "320,390,768,1440").split(",").map(Number);
mkdirSync(outDir, { recursive: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

for (const w of widths) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900)); // let entrance animations settle

  const diag = await page.evaluate((vw) => {
    const docW = document.documentElement.scrollWidth;
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.toString().slice(0, 60)) || "",
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
    // De-dupe to the widest few, ignoring elements whose parent also overflows.
    const top = offenders.sort((a, b) => b.right - a.right).slice(0, 6);
    return { docW, vw, overflow: docW - vw, offenders: top };
  }, w);

  console.log(`\n[${w}px] scrollWidth=${diag.docW} viewport=${diag.vw} overflow=${diag.overflow}px`);
  if (diag.overflow > 0) diag.offenders.forEach((o) => console.log(`   ↳ <${o.tag} class="${o.cls}"> right=${o.right} w=${o.width}`));

  await page.screenshot({ path: `${outDir}/full-${w}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log("\ndone");
