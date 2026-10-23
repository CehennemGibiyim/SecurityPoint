import puppeteer from 'puppeteer';

const B = 'http://127.0.0.1:3000';
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const pageErrors = [];
page.on('pageerror', err => pageErrors.push(String(err)));

console.log('1) /personel yükleniyor...');
await page.goto(B + '/personel', { waitUntil: 'networkidle0', timeout: 30000 });

console.log('2) Örnek Personel (AYŞE ÇELİK) butonuna tıklanıyor...');
const demoBtnClicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.innerText.includes('AYŞE ÇELİK'));
  if (!btn) return false;
  btn.click();
  return true;
});
console.log('   Demo buton tıklandı:', demoBtnClicked);
await new Promise(r => setTimeout(r, 2500));

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    hasName: text.includes('AYŞE ÇELİK'),
    hasCalendar: text.includes('Nöbet Takvimim'),
    hasShifts: text.includes('Nöbet Listem'),
    hasLeaves: text.includes('İzinlerim'),
    hasBalances: text.includes('Yıllık') && text.includes('Rapor'),
  };
});
console.log('   Sorgu sonuçları:', result);
console.log('   Sayfa hataları:', pageErrors.length ? pageErrors : 'YOK');

const ok = demoBtnClicked && result.hasName && result.hasCalendar && result.hasShifts && result.hasLeaves && pageErrors.length === 0;
console.log(ok ? '✅ PERSONEL BİLGİ EKRANI TAM ÇALIŞIYOR' : '❌ SORUN VAR');
await browser.close();
process.exit(ok ? 0 : 1);
