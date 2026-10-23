import puppeteer from 'puppeteer';

const B = 'http://127.0.0.1:3000';
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
page.on('pageerror', err => pageErrors.push(String(err).slice(0, 400)));
page.on('requestfailed', req => failedRequests.push(`${req.url()} -> ${req.failure()?.errorText}`));

console.log('1) Sayfa yükleniyor...');
await page.goto(B + '/', { waitUntil: 'networkidle0', timeout: 45000 });

// Spinner var mı?
const spinner = await page.evaluate(() => document.body.innerText.includes('PUANTAJ YÜKLENİYOR') || document.body.innerText.includes('Puantaj yükleniyor'));
console.log('   Spinner görünüyor mu:', spinner);

// İçerik render edildi mi?
const hasContent = await page.evaluate(() => document.body.innerText.includes('Personel26') && document.body.innerText.includes('Nöbet Çizelgesi'));
console.log('   İçerik render edildi:', hasContent);

// React hidrasyonu tamam mı? — bir nav butonuna tıkla ve sayfanın değiştiğini doğrula
console.log('2) Nöbet Çizelgesi menüsüne tıklanıyor...');
const clicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('nav button')];
  const target = btns.find(b => b.innerText.includes('Nöbet Çizelgesi'));
  if (!target) return false;
  target.click();
  return true;
});
console.log('   Buton bulundu ve tıklandı:', clicked);
await new Promise(r => setTimeout(r, 3000));

const nobetVisible = await page.evaluate(() => document.body.innerText.includes('Aylık Çizelge') || document.body.innerText.includes('Nöbet Sütunları') || document.body.innerText.includes('Taslak Oluştur'));
console.log('   Nöbet sayfası açıldı:', nobetVisible);

console.log('3) Vardiya Şablonları menüsüne tıklanıyor...');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('nav button')];
  btns.find(b => b.innerText.includes('Vardiya Şablonları'))?.click();
});
await new Promise(r => setTimeout(r, 2000));
const sablonVisible = await page.evaluate(() => document.body.innerText.includes('Şablon') && (document.body.innerText.includes('Uygula') || document.body.innerText.includes('İşle')));
console.log('   Şablonlar sayfası açıldı:', sablonVisible);

console.log('4) Personel Yönetimi menüsüne tıklanıyor...');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('nav button')];
  btns.find(b => b.innerText.includes('Personel Yönetimi'))?.click();
});
await new Promise(r => setTimeout(r, 2500));
const persVisible = await page.evaluate(() => document.body.innerText.includes('Personel Yönetim Sistemi') || document.body.innerText.includes('Yeni Personel'));
console.log('   Personel sayfası açıldı:', persVisible);

console.log('5) Puantaja geri dönülüyor...');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('nav button')];
  btns.find(b => b.innerText.includes('Puantaj') && b.innerText.includes('cetveli'))?.click();
});
await new Promise(r => setTimeout(r, 2500));
const puantajVisible = await page.evaluate(() => document.body.innerText.includes('Hafta') && document.body.innerText.includes('Personel Ekle'));
console.log('   Puantaj sayfası açıldı:', puantajVisible);

console.log('\n=== HATALAR ===');
console.log('Console errors:', consoleErrors.length ? consoleErrors : 'YOK');
console.log('Page errors:', pageErrors.length ? pageErrors : 'YOK');
console.log('Failed requests:', failedRequests.length ? failedRequests : 'YOK');

await page.screenshot({ path: '/tmp/final-state.png' });
await browser.close();

const ok = !spinner && hasContent && clicked && nobetVisible && sablonVisible && persVisible && puantajVisible && pageErrors.length === 0;
console.log('\nSONUÇ:', ok ? '✅ TÜM TESTLER GEÇTİ' : '❌ SORUN VAR');
process.exit(ok ? 0 : 1);
