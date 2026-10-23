/**
 * TEK SAYFA ÇIKTI TESTİ — üretilen PDF'in sayfa sayısını sayar.
 * Senaryolar: normal ay, 6 haftalık ay (Kasım 2026), 35 personelli yoğun servis, nöbet listesi.
 * Ek olarak: elle "9" saat girişinin 8 net olarak kaydedildiğini doğrular.
 */
import puppeteer from "puppeteer";
import { writeFileSync } from "node:fs";
const B = "http://127.0.0.1:3000";
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));

const pdfPages = (buf) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;

async function printCase(label, file) {
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Yazdır / PDF"))?.click());
  await wait(700);
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi aç"))?.click());
  await wait(1500);
  const info = await page.evaluate(() => document.querySelector(".print-fit-info")?.textContent?.trim());
  const buf = Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  writeFileSync(file, buf);
  const pages = pdfPages(buf);
  const text = await page.evaluate(() => document.getElementById("print-area")?.innerText ?? "");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi Kapat"))?.click());
  await wait(400);
  console.log(`${pages === 1 ? "✓" : "✗"} ${label}: ${pages} sayfa · ${info} · ${Math.round(buf.length / 1024)} KB`);
  return { pages, text };
}
const nav = (l) => page.evaluate((x) => [...document.querySelectorAll("nav button")].find(b => b.innerText.includes(x))?.click(), l);
const nextMonth = () => page.evaluate(() => document.querySelector('button[title="Sonraki ay"]')?.click());
const prevMonth = () => page.evaluate(() => document.querySelector('button[title="Önceki ay"]')?.click());

await page.goto(B + "/", { waitUntil: "networkidle0", timeout: 45000 });
const results = [];

// 1) Normal ay
const r1 = await printCase("Puantaj · Eylül 2026 (5 hafta)", "/tmp/p1.pdf");
results.push(r1.pages === 1 && r1.text.includes("AYLIK ÖZET") && (r1.text.match(/\d\. Hafta \(/g) || []).length === 5);

// 2) 6 haftalık ay
await nextMonth(); await wait(1200); await nextMonth(); await wait(1800);
const r2 = await printCase("Puantaj · Kasım 2026 (6 hafta)", "/tmp/p2.pdf");
results.push(r2.pages === 1 && (r2.text.match(/\d\. Hafta \(/g) || []).length === 6);

// 3) Yoğun servis: +30 personel
const dept = await page.evaluate(async () => (await (await fetch("/api/bootstrap")).json()).departments[0].id);
const ids = await page.evaluate(async (d) => {
  const out = [];
  for (let i = 1; i <= 30; i++) {
    const r = await fetch("/api/personnel", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `YOGUN TEST ${String(i).padStart(2, "0")}`, personnelType: "ISCI", departmentIds: [d] }) });
    out.push((await r.json()).personnel.id);
  }
  return out;
}, dept);
await page.reload({ waitUntil: "networkidle0" }); await wait(1000);
await nextMonth(); await wait(1200); await nextMonth(); await wait(2000);
const r3 = await printCase("Puantaj · 35 personel × 6 hafta (yoğun)", "/tmp/p3.pdf");
results.push(r3.pages === 1 && r3.text.includes("YOGUN TEST 30"));

// 4) Nöbet listesi (yoğun serviste)
await prevMonth(); await wait(1000); await prevMonth(); await wait(1200);
await nav("Nöbet Çizelgesi"); await wait(2500);
const r4 = await printCase("Nöbet listesi · Eylül 2026 (35 personel özeti)", "/tmp/n1.pdf");
results.push(r4.pages === 1 && r4.text.includes("ONAY MAKAM"));

// temizlik
await page.evaluate(async (list) => { for (const id of list) await fetch("/api/personnel", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hard: true }) }); }, ids);

// 5) Elle saat girişi: "9" → 8 net
await nav("Puantaj"); await wait(2500);
const manual = await page.evaluate(async () => {
  const inp = [...document.querySelectorAll(".pui table .day-inp")].find(i => !i.disabled && !i.value);
  if (!inp) return { found: false };
  const title = inp.title;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  inp.focus(); setter.call(inp, "9"); inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.blur();
  return { found: true, title };
});
await wait(2000);
const saved = await page.evaluate(async () => {
  const boot = await (await fetch("/api/bootstrap")).json();
  const dept = boot.departments[0].id;
  const ids = boot.personnel.filter(p => p.departmentId === dept).map(p => p.id).join(",");
  const now = new Date();
  const r = await (await fetch(`/api/timesheet?year=2026&month=8&dept=${dept}&personnel=${ids}`)).json();
  const m = r.entries.filter(e => e.shiftType === "MANUAL");
  return m.map(e => ({ id: e.id, pid: e.personnelId, date: e.entryDate, h: e.hoursWorked }));
});
const manualOk = saved.some(e => e.h === 8);
console.log(`${manualOk ? "✓" : "✗"} Elle "9" saat girişi → kaydedilen net: ${saved.map(e => e.h).join(", ") || "yok"}`);
results.push(manualOk);
await page.evaluate(async (list) => { for (const e of list) await fetch("/api/timesheet", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personnelId: e.pid, entryDate: e.date }) }); }, saved);

console.log("Sayfa hataları:", errs.length ? errs : "YOK");
const ok = results.every(Boolean) && errs.length === 0;
console.log(ok ? "✅ HER SENARYODA TEK SAYFA + DOĞRU NET SAAT" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);
