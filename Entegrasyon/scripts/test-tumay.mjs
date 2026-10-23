import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

// "Tüm Ay" düğmesine tıkla
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Tüm Ay");
  if (!b) return false;
  b.click();
  return true;
});
console.log("Tüm Ay düğmesi tıklandı:", clicked);
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const table = document.querySelector(".pui table");
  const headRow2 = table?.querySelectorAll("thead tr")[1];
  const headers = headRow2 ? [...headRow2.querySelectorAll("th")].map(t => t.textContent.trim()).filter(Boolean) : [];
  const firstBodyRow = table?.querySelector("tbody tr");
  const cellCount = firstBodyRow ? firstBodyRow.querySelectorAll("td").length : 0;
  const weekHeaders = [...(table?.querySelectorAll("thead th") ?? [])].map(t => t.textContent).filter(t => t.includes("Hafta")).length;
  const hasMonthly = [...(table?.querySelectorAll("thead th") ?? [])].some(t => t.textContent.includes("Aylık Özet"));
  return { cellCount, weekHeaders, hasMonthly, sumHeaders: headers.slice(-4) };
});
console.log("Satır hücre sayısı:", result.cellCount, "(tüm ay = 30 gün + 5×6 hafta + 4 aylık + 1 isim = 65 beklenir)");
console.log("Hafta başlıkları:", result.weekHeaders, "| Aylık Özet başlığı:", result.hasMonthly);
console.log("Son özet başlıkları:", result.sumHeaders);

// Haftalık görünüme geri dön
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "Haftalık")?.click();
});
await new Promise(r => setTimeout(r, 1000));
const backOk = await page.evaluate(() => {
  const row = document.querySelector(".pui table tbody tr");
  return row ? row.querySelectorAll("td").length : 0;
});
console.log("Haftalık görünüme dönüş, hücre sayısı:", backOk, "(~13 beklenir)");
console.log("Sayfa hataları:", errs.length ? errs : "YOK");
const ok = clicked && result.cellCount >= 60 && result.hasMonthly && backOk < 20 && errs.length === 0;
console.log(ok ? "✅ TÜM AY GÖRÜNÜMÜ ÇALIŞIYOR" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);
