import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
let passed = 0;
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json(); return { response, data };
}
function check(name, condition) { assert.ok(condition, name); passed++; console.log('PASS', name); }
const { data: boot } = await request('/api/bootstrap');
const { data: original } = await request('/api/settings');
const { data: backup } = await request('/api/backup', 'POST');
const snapshot = (await request(`/api/backup/${backup.id}`)).data;
const personName = 'OTOMATİK AKTARIM TESTİ';
const serviceText = boot.departments.slice(0, 2).map(d => d.name).join(';');
const existing = boot.personnel.find(p => p.tcNo);
const input = { mode: 'preview', fileName: 'test.csv', startRow: 2, mapping: { name: 0, tcNo: 1, personnelType: 2, staffGroup: 3, departments: 4 }, defaults: { personnelType: 'MEMUR', staffGroup: 'SAGLIK', departmentIds: [] }, rows: [
  [personName, '11111111110', 'Hemşire', 'Hemşire/Sağlık', serviceText],
  ['MEVCUT TC TESTİ', existing.tcNo, 'Memur', 'Sağlık', serviceText],
  ['HATALI SATIR', '123', 'Tanımsız', 'Sağlık', 'Olmayan servis'],
  ['DOSYADA TC TEKRARI', '11111111110', 'İşçi', 'Temizlik/Destek', serviceText],
  [personName, '22222222220', 'İşçi', 'Temizlik/Destek', serviceText],
] };
try {
  check('Veritabanı bağlı ve şema güncel', original.status.connected && original.status.schemaVersion === '2026.01');
  const { response: settingResponse, data: saved } = await request('/api/settings', 'PUT', { ...original.settings, institution: 'TEST KURUM BİLGİSİ', theme: 'forest' });
  check('Ayarlar kalıcı kaydedildi', settingResponse.ok && saved.settings.theme === 'forest' && (await request('/api/settings')).data.settings.institution === 'TEST KURUM BİLGİSİ');
  const invalidSetting = await request('/api/settings', 'PUT', { ...original.settings, backupRetention: -2 });
  check('Geçersiz ayar reddedildi', invalidSetting.response.status === 400);
  const { response: previewResponse, data: preview } = await request('/api/personnel/import', 'POST', input);
  check('Önizleme doğrulandı', previewResponse.ok && preview.summary.total === 5 && preview.summary.valid === 1 && preview.summary.duplicate === 2 && preview.summary.error === 1 && preview.summary.warning === 1);
  check('Çoklu servis eşleştirme', preview.rows[0].record.departmentIds.length === 2);
  check('Sınıf ve grup ayrımı', preview.rows[4].record.personnelType === 'ISCI' && preview.rows[4].record.staffGroup === 'DESTEK');
  check('Hata raporu açıklamalı', preview.rows[2].errors.length >= 3 && preview.rows[2].errors.some(message => message.includes('TC kimlik')) && preview.rows[2].row === 4);
  const before = (await request('/api/personnel')).data.personnel.length;
  const rejected = await request('/api/personnel/import', 'POST', { ...input, mode: 'commit', confirmed: true });
  check('Hatalı toplu kayıt engellendi', rejected.response.status === 400 && (await request('/api/personnel')).data.personnel.length === before);
  const success = await request('/api/personnel/import', 'POST', { ...input, mode: 'commit', confirmed: true, skipInvalid: true, acceptNames: false });
  check('Sadece geçerli satır kaydedildi', success.response.ok && success.data.imported === 1 && success.data.skipped === 4);
  const list = (await request('/api/personnel')).data.personnel;
  const imported = list.find(p => p.tcNo === '11111111110');
  check('Servisler gerçek veritabanına kaydedildi', imported?.departmentIds.length === 2);
  const again = await request('/api/personnel/import', 'POST', input);
  check('Tekrar yükleme mükerrer TC olarak işaretlendi', again.data.rows[0].status === 'duplicate');
  const namesAccepted = await request('/api/personnel/import', 'POST', { ...input, mode: 'commit', confirmed: true, skipInvalid: true, acceptNames: true });
  check('İsim uyarısı ancak açık onayla aktarılır', namesAccepted.response.ok && namesAccepted.data.imported === 1);
  const invalidBackup = await request('/api/database', 'POST', { action: 'restore', data: { personnel: [] }, confirm: 'GERİ YÜKLE' });
  check('Eksik yedek veri silmeden reddedildi', invalidBackup.response.status === 400 && (await request('/api/personnel')).data.personnel.length === before + 2);
  const badRelations = JSON.parse(JSON.stringify(snapshot)); badRelations.departments = [];
  const rollback = await request('/api/database', 'POST', { action: 'restore', data: badRelations, confirm: 'GERİ YÜKLE' });
  check('Başarısız geri yükleme tamamen geri alındı', rollback.response.status === 400 && (await request('/api/personnel')).data.personnel.length === before + 2);
  const sql = await (await fetch(base + '/api/database?format=sql')).text();
  check('Tam veri SQL yedeği üretildi', sql.includes('BEGIN;') && sql.includes('"tc_no"') && sql.includes('"app_settings"') && sql.includes('COMMIT;'));
  const schemaSql = await (await fetch(base + '/api/database?format=schema')).text();
  check('Şema SQL veri silmez', schemaSql.includes('IF NOT EXISTS') && !/DROP|TRUNCATE|DELETE FROM/.test(schemaSql));
  const filePreview = await request('/api/database', 'POST', { action: 'preview', data: snapshot });
  check('Dosyadan geri yükleme önizlemesi', filePreview.response.ok && filePreview.data.counts.personnel === before);
} finally {
  const restored = await request('/api/database', 'POST', { action: 'restore', data: snapshot, confirm: 'GERİ YÜKLE' });
  assert.ok(restored.response.ok, 'Test sonrasında başlangıç verisi geri yüklenmeli');
  await request('/api/settings', 'PUT', original.settings);
  check('JSON yedekten geri dönüş ve ayarlar korundu', (await request('/api/personnel')).data.personnel.length === snapshot.personnel.length);
}
console.log(`\n${passed} API/veritabanı testi geçti.`);
