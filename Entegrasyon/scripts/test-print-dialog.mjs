import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

console.log("── PUANTAJ ──");
// Yazdır'a bas → dialog açılmalı
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Yazdır / PDF"))?.click();
});
await new Promise(r => setTimeout(r, 800));
const dlg = await page.evaluate(() => ({
  open: document.body.innerText.includes("Yazdırma öncesi seçim"),
  weekly: document.body.innerText.includes("Haftalık puantaj tabloları"),
  monthly: document.body.innerText.includes("Aylık özet"),
  sig: document.body.innerText.includes("Onay ve imza alanları"),
  dipnot: !!document.querySelector("textarea"),
}));
console.log("Dialog:", dlg);

// Dipnot yaz → Önizlemeyi aç
await page.type("textarea", "Eylül ayı test dipnotudur — fazla mesailer onaylıdır.");
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi aç"))?.click();
});
await new Promise(r => setTimeout(r, 900));

const preview = await page.evaluate(() => {
  const pa = document.getElementById("print-area");
  const txt = pa?.innerText ?? "";
  return {
    previewOpen: document.body.classList.contains("print-preview-open"),
    title: txt.includes("PUANTAJ FORMU"),
    legend: txt.includes("Kod açıklamaları"),
    weekBlocks: (txt.match(/\d\. Hafta \(/g) || []).length,
    monthly: txt.includes("AYLIK ÖZET"),
    durum: txt.includes("saat eksik") || txt.includes("saat fazla") || txt.includes("tam"),
    note: txt.includes("test dipnotudur"),
    sig: txt.includes("Sorumlu Hemşire"),
    weekTables: pa?.querySelectorAll("table.pw").length ?? 0,
  };
});
console.log("Önizleme:", preview);

// Kapat
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi Kapat"))?.click();
});
await new Promise(r => setTimeout(r, 500));

console.log("── 6 HAFTALIK AY (Kasım 2026: Paz başlar, 30 gün → 6 hafta) ──");
// Ay ileri: Eylül→Ekim→Kasım
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => { document.querySelector('button[title="Sonraki ay"]')?.click(); });
  await new Promise(r => setTimeout(r, 1200));
}
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Yazdır / PDF"))?.click();
});
await new Promise(r => setTimeout(r, 700));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi aç"))?.click();
});
await new Promise(r => setTimeout(r, 900));
const six = await page.evaluate(() => {
  const txt = document.getElementById("print-area")?.innerText ?? "";
  return { blocks: (txt.match(/\d\. Hafta \(/g) || []).length, month: txt.match(/Kasım \d{4}/)?.[0] };
});
console.log("Kasım hafta blokları:", six);
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi Kapat"))?.click();
});
await new Promise(r => setTimeout(r, 400));

console.log("── NÖBET ÇİZELGESİ ──");
await page.evaluate(() => {
  [...document.querySelectorAll("nav button")].find(b => b.innerText.includes("Nöbet Çizelgesi"))?.click();
});
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Yazdır / PDF"))?.click();
});
await new Promise(r => setTimeout(r, 800));
const ndlg = await page.evaluate(() => ({
  open: document.body.innerText.includes("Yazdırma öncesi seçim"),
  sum: document.body.innerText.includes("Servis ve toplam saat"),
}));
console.log("Nöbet dialog:", ndlg);
await page.type("textarea", "Nöbet listesi dipnotu.");
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find(b => b.textContent.includes("Önizlemeyi aç"))?.click();
});
await new Promise(r => setTimeout(r, 900));
const npv = await page.evaluate(() => {
  const txt = document.getElementById("print-area")?.innerText ?? "";
  return {
    title: /NÖBET LİSTESİ/.test(txt),
    servisBox: txt.includes("SERVİSLER / HİZMET ALANLARI"),
    toplamBox: txt.includes("TOPLAM SAATLER") && txt.includes("Net saat"),
    onay: txt.includes("ONAY MAKAM LİSTESİ"),
    note: txt.includes("Nöbet listesi dipnotu"),
  };
});
console.log("Nöbet önizleme:", npv);

console.log("\nSayfa hataları:", errs.length ? errs : "YOK");
const ok = dlg.open && dlg.dipnot && preview.previewOpen && preview.weekBlocks >= 5 && preview.monthly && preview.note && six.blocks === 6 && ndlg.open && npv.servisBox && npv.toplamBox && npv.onay && npv.note && errs.length === 0;
console.log(ok ? "✅ TÜM YAZDIRMA AKIŞLARI ÇALIŞIYOR" : "❌ SORUN VAR");
await browser.close();
process.exit(ok ? 0 : 1);
