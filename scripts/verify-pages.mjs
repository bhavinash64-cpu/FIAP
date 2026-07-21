import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox","--disable-gpu","--hide-scrollbars"] });
async function check(path, sizes, label) {
  console.log(`\n=== ${label} (${path}) ===`);
  for (const [w,h] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width:w, height:h, deviceScaleFactor:1 });
    await page.goto("http://localhost:4190"+path, { waitUntil:"networkidle0", timeout:30000 });
    await new Promise(r=>setTimeout(r,800));
    const m = await page.evaluate((vw,vh) => {
      // getBoundingClientRect sees true positions even under overflow:clip/hidden.
      let maxRight=0, minLeft=0, maxBottom=0, worst=null;
      for (const el of document.body.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width===0||r.height===0) continue;
        if (r.right>maxRight){maxRight=r.right; if(r.right>vw+1) worst={t:el.tagName.toLowerCase(),c:(el.className||"").toString().slice(0,44),right:Math.round(r.right),w:Math.round(r.width)};}
        if (r.left<minLeft) minLeft=r.left;
        if (r.bottom>maxBottom) maxBottom=r.bottom;
      }
      return { hOver: Math.round(Math.max(0,maxRight-vw, -minLeft)), vOver: Math.round(Math.max(0,maxBottom-vh)), worst };
    }, w, h);
    const wc = m.worst ? `  ↳ <${m.worst.t} class="${m.worst.c}"> right=${m.worst.right}` : "";
    console.log(`  ${w}x${h}: h-overflow=${m.hOver>1?"⚠ "+m.hOver+"px":"none"}  v-overflow=${m.vOver>1?m.vOver+"px":"none"}${wc}`);
    await page.close();
  }
}
await check("/auth", [[320,568],[360,640],[390,844],[414,896],[768,1024],[820,1180],[1440,900]], "Auth");
await check("/", [[320,720],[390,844],[414,896]], "Landing");
await browser.close();
console.log("\ndone");
