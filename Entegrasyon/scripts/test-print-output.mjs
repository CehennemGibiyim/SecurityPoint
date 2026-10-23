/**
 * YAZDIRMA ÇIKTISI TESTİ: "print" medya modunda gerçekten ne basıldığını ölçer
 * ve PDF üretir. Boş çıktı hatasını yakalamak için.
 */
import puppeteer from "puppeteer";
import { writeFileSync } from "node:fs";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

async function openPrint(menu) {
  if (menu) {
    await page.evaluate((m) => { [...document.querySelectorAll("nav button")].find(b => b.innerText.includes(m))?.click(); }, menu);
    await new Promise(r => setTimeout(r, 2500));
  }
  await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Yazdır / PDF"))?.click(); });
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi aç"))?.click(); });
  await new Promise(r => setTimeout(r, 900));
}

async function measure(label, file) {
  await page.emulateMediaType("print");
  const m = await page.evaluate(() => {
    const pa = document.getElementById("print-area");
    if (!pa) return { exists: false };
    const cs = getComputedStyle(pa);
    const r = pa.getBoundingClientRect();
    return {
      exists: true, display: cs.display, position: cs.position, visibility: cs.visibility,
      color: cs.color, height: Math.round(r.height), textLen: pa.innerText.trim().length,
      bodyOverflow: getComputedStyle(document.body).overflow,
      screenRootDisplay: getComputedStyle(document.querySelector(".screen-root") || document.body).display,
    };
  });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  writeFileSync(file, pdf);
  await page.emulateMediaType("screen");
  console.log(label, JSON.stringify(m), "| PDF bytes:", pdf.length);
  return { m, size: pdf.length };
}

await openPrint(null);
const a = await measure("PUANTAJ", "/tmp/puantaj.pdf");
await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi Kapat"))?.click(); });
await new Promise(r => setTimeout(r, 400));
await openPrint("Nöbet Çizelgesi");
const b = await measure("NOBET  ", "/tmp/nobet.pdf");
await browser.close();
