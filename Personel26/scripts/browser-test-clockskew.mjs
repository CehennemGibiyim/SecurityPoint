/**
 * KULLANICI SENARYOSU TESTİ: Tarayıcı saati sunucudan FARKLI.
 * (Kullanıcının bilgisayarındaki gerçek tarih ile sandbox tarihi farklıydı;
 * bu, hidrasyon uyuşmazlığı → donuk sayfa hatasına yol açıyordu.)
 * Bu test, tarayıcı saatini 1 yıl geriye alarak sorunu birebir taklit eder.
 */
import puppeteer from "puppeteer";

const B = "http://127.0.0.1:3000";
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Tarayıcı saatini ~13 ay geriye kaydır (kullanıcının durumu)
const SKEW_MS = -13 * 30 * 24 * 60 * 60 * 1000;
await page.evaluateOnNewDocument((skew) => {
  const RealDate = Date;
  // @ts-ignore
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) { super(RealDate.now() + skew); } else { super(...args); }
    }
    static now() { return RealDate.now() + skew; }
  };
}, SKEW_MS);

const pageErrors = [];
const hydrationErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("Hydration") || t.includes("hydration") || t.includes("418") || t.includes("423") || t.includes("425")) {
    hydrationErrors.push(t.slice(0, 200));
  }
});

console.log("1) Saati kaydırılmış tarayıcıyla sayfa yükleniyor...");
await page.goto(B + "/", { waitUntil: "networkidle0", timeout: 45000 });

const clientDate = await page.evaluate(() => new Date().toISOString().slice(0, 10));
console.log("   Tarayıcının gördüğü tarih:", clientDate, "(sunucudan farklı)");

const monthLabel = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((s) => /20\d\d/.test(s.textContent) && s.textContent.length < 20);
  return el?.textContent?.trim();
});
console.log("   Görünen ay etiketi:", monthLabel);

console.log("2) DONMA TESTİ — Nöbet Çizelgesi'ne tıklanıyor...");
await page.evaluate(() => {
  [...document.querySelectorAll("nav button")].find((b) => b.innerText.includes("Nöbet Çizelgesi"))?.click();
});
await new Promise((r) => setTimeout(r, 3000));
const nobetOk = await page.evaluate(() => document.body.innerText.includes("Taslak Oluştur") || document.body.innerText.includes("Nöbet Sütunları"));
console.log("   Nöbet sayfası açıldı:", nobetOk);

console.log("3) Personel Yönetimi'ne tıklanıyor...");
await page.evaluate(() => {
  [...document.querySelectorAll("nav button")].find((b) => b.innerText.includes("Personel Yönetimi"))?.click();
});
await new Promise((r) => setTimeout(r, 2500));
const persOk = await page.evaluate(() => document.body.innerText.includes("Yeni Personel"));
console.log("   Personel sayfası açıldı:", persOk);

console.log("4) Ay değiştirme butonu test ediliyor...");
await page.evaluate(() => {
  [...document.querySelectorAll("nav button")].find((b) => b.innerText.includes("Puantaj") && b.innerText.includes("cetveli"))?.click();
});
await new Promise((r) => setTimeout(r, 2000));
const before = await page.evaluate(() => document.body.innerText.match(/(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) 20\d\d/)?.[0]);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button[title="Sonraki ay"]')][0];
  btn?.click();
});
await new Promise((r) => setTimeout(r, 2000));
const after = await page.evaluate(() => document.body.innerText.match(/(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) 20\d\d/)?.[0]);
console.log(`   Ay değişimi: ${before} → ${after} (${before !== after ? "ÇALIŞIYOR" : "DONUK!"})`);

console.log("\n=== SONUÇ ===");
console.log("Hidrasyon hataları:", hydrationErrors.length ? hydrationErrors : "YOK ✓");
console.log("Sayfa hataları:", pageErrors.length ? pageErrors : "YOK ✓");

const ok = nobetOk && persOk && before !== after && hydrationErrors.length === 0 && pageErrors.length === 0;
console.log(ok ? "✅ SAAT FARKI OLSA BİLE SİSTEM AKICI ÇALIŞIYOR" : "❌ SORUN DEVAM EDİYOR");
await browser.close();
process.exit(ok ? 0 : 1);
