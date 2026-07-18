import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe", headless:"new", args:["--no-sandbox","--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width:1440, height:900, deviceScaleFactor:1 });
await page.goto("http://localhost:4190/auth", { waitUntil:"networkidle0" });
await new Promise(r=>setTimeout(r,700));
const out = await page.evaluate((vh) => {
  const rows=[];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.bottom > vh+1 && r.height>10) rows.push({ t:el.tagName.toLowerCase(), c:(el.className||"").toString().slice(0,60), top:Math.round(r.top), bottom:Math.round(r.bottom), h:Math.round(r.height) });
  }
  return rows.sort((a,b)=>b.bottom-a.bottom).slice(0,8);
}, 900);
console.log(JSON.stringify(out,null,1));
await browser.close();
