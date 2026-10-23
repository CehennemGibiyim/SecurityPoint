/**
 * Türkçe alfabetik sıralama testi: bootstrap'te gelen ve başlık
 * ile mobil çubuktaki departman sırası eşit ve doğru olmalı.
 * Yalnızca OKUMA / SIRALAMA testleri — yazma yok.
 */
import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

const headerDepts = await page.evaluate(() =>
  [...document.querySelector("header").children[0].querySelectorAll("button")]
    .map(b => b.textContent.trim()).filter(t => t && t !== "Düzenle")
);
const sidebarNotes = await page.evaluate(() => [...document.querySelectorAll("select")].flatMap(s => [...s.querySelectorAll("option")].map(o => o.value)).length);

// API üzerinden doğrudan da kontrol et
const apiOrder = await page.evaluate(async () => {
  const r = await (await fetch("/api/departments")).json();
  return r.departments.map(d => d.name);
});

const trExpected = (names) => [...names].sort((a, b) => a.localeCompare(b, "tr-TR", { sensitivity: "base", numeric: true }));

console.log("API sırası:        ", apiOrder);
console.log("Üst çubuk sırası:  ", headerDepts);
console.log("Beklenen (tr-TR):  ", trExpected(apiOrder));
console.log("API sıralı mı:      ", JSON.stringify(apiOrder) === JSON.stringify(trExpected(apiOrder)));
console.log("UI sıralı mı:      ", JSON.stringify(headerDepts) === JSON.stringify(trExpected(apiOrder)));
console.log("Sayfa hataları:    ", errs.length ? errs : "YOK");
const ok = JSON.stringify(apiOrder) === JSON.stringify(trExpected(apiOrder))
       && JSON.stringify(headerDepts) === JSON.stringify(trExpected(apiOrder))
       && errs.length === 0;
console.log(ok ? "✅ TÜRKÇE ALFABETİK SIRALAMA DOĞRU" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);
