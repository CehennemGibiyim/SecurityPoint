import puppeteer from "puppeteer";
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errs = [];
async function check(width) {
  const page = await browser.newPage();
  page.on("pageerror", e => errs.push(String(e).slice(0, 150)));
  await page.setViewport({ width, height: 900 });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 60000 });
  await wait(1500);
  // Görünür (offsetParent !== null) tetikleyiciyi bul
  const openedInitial = await page.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
    if (!t) return null;
    t.click();
    return { text: t.textContent.replace(/\s+/g, " ").trim() };
  });
  if (!openedInitial) { await page.close(); return false; }
  await wait(450);
  const open = await page.evaluate(() => {
    const lb = document.querySelector('[role=listbox]');
    return { ok: !!lb, items: lb ? lb.querySelectorAll('[role=option]').length : 0 };
  });
  await page.mouse.click(20, 20);
  await wait(120);
  const closedAfterOutside = await page.evaluate(() => !document.querySelector('[role=listbox]'));
  // ESC ile kapansın
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
    t.click();
  });
  await wait(300);
  await page.keyboard.press("Escape");
  await wait(120);
  const closedAfterEsc = await page.evaluate(() => !document.querySelector('[role=listbox]'));
  // Seçim sonrası kapansın
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
    t.click();
  });
  await wait(300);
  await page.evaluate(() => {
    const opt = document.querySelectorAll('[role=option]')[2];
    opt && opt.click();
  });
  await wait(700);
  const afterPick = await page.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-haspopup="listbox"]')].find(b => b.offsetParent !== null);
    return { closed: !document.querySelector('[role=listbox]'), newText: t ? t.textContent.replace(/\s+/g,' ').trim() : null };
  });
  console.log(`${width}px → tetikleyici: "${openedInitial.text}", açıldı: ${open.ok} (${open.items} öğe)`);
  console.log(`  dışına tıklayınca kapanıyor: ${closedAfterOutside ? "EVET" : "HAYIR"}`);
  console.log(`  ESC ile kapanıyor:           ${closedAfterEsc ? "EVET" : "HAYIR"}`);
  console.log(`  seçim sonrası: "${afterPick.newText}", kapalı: ${afterPick.closed ? "EVET" : "HAYIR"}`);
  await page.close();
  return open.ok && open.items > 0 && closedAfterOutside && closedAfterEsc && afterPick.closed && /[A-Z]/.test(afterPick.newText);
}
const a = await check(1400); console.log();
const b = await check(420); console.log();
console.log("Hatalar:", errs.length ? errs : "YOK");
const ok = a && b && errs.length === 0;
console.log(ok ? "✅ SERVİS MENÜSÜ DOĞRU" : "❌");
await browser.close();
process.exit(ok ? 0 : 1);
