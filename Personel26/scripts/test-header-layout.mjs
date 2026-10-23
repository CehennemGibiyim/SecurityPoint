/**
 * ÜST ÇUBUK DÜZEN TESTİ: departman düğmeleri tek satırda mı, öğeler üst üste
 * biniyor mu? Farklı ekran genişliklerinde ölçer ve görüntü alır.
 */
import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
let ok = true;
for (const width of [1230, 1024, 1600]) {
  await page.setViewport({ width, height: 760 });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle0", timeout: 45000 });
  const m = await page.evaluate(() => {
    const header = document.querySelector("header");
    const rows = header ? [...header.children] : [];
    const deptBtns = rows[0] ? [...rows[0].querySelectorAll("button")].filter(b => b.textContent.trim()) : [];
    const tops = [...new Set(deptBtns.map(b => Math.round(b.getBoundingClientRect().top)))];
    // Çakışma: başlık, ekip sekmeleri ve ay seçicinin kutuları kesişiyor mu?
    const boxes = rows[1] ? [rows[1].querySelector("h1"), rows[1].querySelector('[role="tablist"]'), [...rows[1].querySelectorAll("span")].find(s => /20\d\d/.test(s.textContent))]
      .filter(Boolean).map(el => el.getBoundingClientRect()) : [];
    let overlap = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap = true;
    }
    return { rows: rows.length, deptCount: deptBtns.length, deptLines: tops.length, overlap, headerH: Math.round(header?.getBoundingClientRect().height ?? 0) };
  });
  const pass = m.rows === 2 && m.deptLines === 1 && !m.overlap;
  ok &&= pass;
  console.log(`${pass ? "✓" : "✗"} ${width}px: ${m.deptCount} departman ${m.deptLines} satırda · çakışma: ${m.overlap ? "VAR" : "yok"} · üst çubuk ${m.headerH}px`);
  if (width === 1230) await page.screenshot({ path: "header-check.png", clip: { x: 0, y: 0, width, height: 420 } });
}
console.log(ok ? "✅ ÜST ÇUBUK DÜZENİ DOĞRU" : "❌ DÜZEN SORUNU");
await browser.close();
process.exit(ok ? 0 : 1);
