/**
 * SERVİS YÖNETİMİ TESTİ — yalnızca kendi oluşturduğu geçici servisle çalışır,
 * kullanıcının mevcut servislerine dokunmaz.
 * API düzeyinde: ekle → aynı ad engellenir → adı düzelt → sil. Üst çubuğun otomatik yenilenmesi
 * Yönet modalindeki çağrılar üzerinden sağlanır (zaten test edildi).
 */
import puppeteer from "puppeteer";
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const TMP = "ZZ Test Servsi";
const FIXED = "ZZ Test Servisi";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errs = [];
page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });

async function api(method, body) {
  return page.evaluate(async ({ m, b }) => {
    const r = await fetch("/api/departments", { method: m, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    return { ok: r.ok, data: await r.json() };
  }, { m: method, b: body });
}

// Yönet penceresini aç ki bootstrap yenilensin (yeni eklenen servis görünsün)
async function openDeptManager() {
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
    t?.click();
  });
  await wait(450);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === "Yönet");
    b?.click();
  });
  await wait(600);
}

// Bootstrap'ı sayfa açıldığında bir kere yaptığı için API üzerinden ekledikten sonra manuel yenileme gerekiyor
const triggerText = () => page.evaluate(() => {
  const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
  return t ? t.textContent.replace(/\s+/g, " ").trim() : null;
});
const before = await triggerText();
console.log("Önce tetikleyici metni:", before);

// 1) Ekle
let added = await api("POST", { name: TMP });
console.log("Ekle API yanıtı:", added.ok ? "OK" : "BAŞARISIZ", added.data?.department?.name || added.data?.error);
await openDeptManager();
const afterAdd = await triggerText();

// 2) Aynı adı ekle → 409
const dup = await api("POST", { name: TMP.toLowerCase() });
console.log("Aynı ad engellendi:", dup.ok === false && /zaten var/.test(dup.data?.error));

// 3) Yanlış yazımı düzelt
const targetId = added.data.department.id;
const patched = await api("PATCH", { id: targetId, name: FIXED });
console.log("Düzeltme API:", patched.ok ? "OK" : patched.data?.error, patched.data?.department?.name);
await openDeptManager();
const afterRename = await triggerText();

// 4) Sil
const del = await api("DELETE", { id: targetId });
console.log("Silme API:", del.ok ? "OK" : del.data?.error);
await openDeptManager();
const afterDelete = await triggerText();

console.log("Eklenince üst çubuk metni:", afterAdd, "→ TMP görünüyor mu:", afterAdd?.includes(TMP));
console.log("Düzeltilince üst çubuk metni:", afterRename, "→ FIXED görünüyor mu:", afterRename?.includes(FIXED), "· eski ad kalktı:", !afterRename?.includes(TMP));
console.log("Silinince üst çubuk metni:", afterDelete, "→ TMP/FIXED kalktı mı:", !afterDelete?.includes(TMP) && !afterDelete?.includes(FIXED));
console.log("Sayfa hataları:", errs.length ? errs : "YOK");
const ok = added.ok && dup.ok === false && patched.ok && patched.data?.department?.name === FIXED && del.ok && errs.length === 0;
console.log(ok ? "✅ SERVİS EKLE / DÜZENLE / SİL ÇALIŞIYOR" : "❌");
await browser.close();
process.exit(ok ? 0 : 1);
