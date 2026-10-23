/**
 * İKİ PERSONEL GRUBU TESTİ: Hemşire/Sağlık ve Temizlik/Destek
 * — grup seçici, ayrı puantaj listeleri, ayrı nöbet çizelgeleri,
 *   ayrı çıktı başlıkları ve her çıktının tek sayfa olması.
 */
import puppeteer from "puppeteer";
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

const clickText = (t) => page.evaluate((x) => [...document.querySelectorAll("button")].find(b => b.textContent.includes(x))?.click(), t);
const nav = (l) => page.evaluate((x) => [...document.querySelectorAll("nav button")].find(b => b.innerText.includes(x))?.click(), l);
const tableNames = () => page.evaluate(() => [...document.querySelectorAll(".pui table tbody .p-name")].map(t => t.innerText.trim()).filter(Boolean));
const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

async function printTitle() {
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Yazdır / PDF"))?.click());
  await wait(700); await clickText("Önizlemeyi aç"); await wait(1500);
  const title = await page.evaluate(() => document.querySelector("#print-area h1")?.innerText);
  const buf = Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  await clickText("Önizlemeyi Kapat"); await wait(400);
  return { title, pages: pdfPages(buf) };
}

const results = {};
// ── Puantaj: iki grup ──
const switchOk = await page.evaluate(() => !!document.querySelector('[role="tablist"][aria-label="Personel grubu"]'));
const sagNames = await tableNames();
const sagPrint = await printTitle();
await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find(b => b.textContent.includes("Temizlik"))?.click()); await wait(2200);
const desNames = await tableNames();
const desPrint = await printTitle();
console.log("Grup seçici görünüyor:", switchOk);
console.log("Puantaj · Hemşire/Sağlık:", sagNames.length, "kişi |", sagNames.slice(0, 3).join(", "));
console.log("Puantaj · Temizlik/Destek:", desNames.length, "kişi |", desNames.slice(0, 3).join(", "));
const overlap = sagNames.filter(n => desNames.includes(n));
console.log("İki listede ortak kişi:", overlap.length ? overlap : "YOK ✓");
console.log("Çıktı 1:", sagPrint.title, "|", sagPrint.pages, "sayfa");
console.log("Çıktı 2:", desPrint.title, "|", desPrint.pages, "sayfa");
results.puantaj = switchOk && sagNames.length > 0 && desNames.length > 0 && overlap.length === 0
  && /HEMŞİRE/.test(sagPrint.title) && /TEMİZLİK/.test(desPrint.title) && sagPrint.pages === 1 && desPrint.pages === 1;

// ── Nöbet çizelgesi: iki grup ──
await nav("Nöbet Çizelgesi"); await wait(2500);
const colsOf = () => page.evaluate(() => [...document.querySelectorAll(".roster-table thead th")].slice(2).map(t => t.innerText.replace(/\s+/g, " ").trim()));
const optionsOf = () => page.evaluate(() => [...(document.querySelector(".roster-select")?.options ?? [])].map(o => o.text).filter(t => t !== "—"));
const desCols = await colsOf(); const desOpts = await optionsOf();
const desNPrint = await printTitle();
await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].find(b => b.textContent.includes("Hemşire"))?.click()); await wait(2500);
const sagCols = await colsOf(); const sagOpts = await optionsOf();
const sagNPrint = await printTitle();
console.log("Nöbet · Temizlik sütunları:", desCols.map(c => c.split(" ").slice(0, 2).join(" ")).join(" | "), "| seçilebilir kişi:", desOpts.length);
console.log("Nöbet · Hemşire sütunları:", sagCols.map(c => c.split(" ").slice(0, 3).join(" ")).join(" | "), "| seçilebilir kişi:", sagOpts.length);
const optOverlap = desOpts.filter(o => sagOpts.includes(o));
console.log("Hücre listelerinde ortak kişi:", optOverlap.length ? optOverlap : "YOK ✓");
console.log("Nöbet çıktısı 1:", sagNPrint.title, "|", sagNPrint.pages, "sayfa");
console.log("Nöbet çıktısı 2:", desNPrint.title, "|", desNPrint.pages, "sayfa");
results.nobet = desCols.some(c => c.includes("Temizlik")) && !sagCols.some(c => c.includes("Temizlik")) && optOverlap.length === 0
  && /HEMŞİRE/.test(sagNPrint.title) && /TEMİZLİK/.test(desNPrint.title) && sagNPrint.pages === 1 && desNPrint.pages === 1;

console.log("Sayfa hataları:", errs.length ? errs : "YOK");
const ok = results.puantaj && results.nobet && errs.length === 0;
console.log(ok ? "✅ İKİ AYRI PUANTAJ + İKİ AYRI NÖBET ÇİZELGESİ ÇALIŞIYOR" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);
