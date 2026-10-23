# Personel26 — Ayarlar ve toplu aktarım

Kaynak: https://github.com/CehennemGibiyim/Personel26 — klonlanan HEAD `9a77dee3e5ef5ccf6bf47f393c94ca579d1bb847`. Kaynak uygulamanın personel, puantaj, nöbet, izin, duyuru, analiz, şablon, değişim, yedek ve personel sorgu ekranları korunarak mevcut proje köküne aktarıldı. Ortam bağlantısı korunur; kullanıcı sırları kaynak depodan alınmaz.

## Eklenenler

- Sol menüde **Ayarlar**; kurum bilgileri ve güvenli küçültülmüş kurum logosu.
- Değişiklikleri kaydet/vazgeç, kaydedilmemiş değişiklik uyarısı.
- Değiştirilmemiş orijinal `globals.css`; 20 ayrı alternatif tema, filtre, önizleme ve ana temaya dönüş. Ek stiller `settings.css` içindedir; alternatiflerin uygulama çapındaki kuralları `original` temasını dışlar.
- Personel listesinde TC maskeleme, isteğe bağlı kompakt tablolar ve azaltılmış hareket.
- Excel/XLS/CSV dosyası (5 MB / 2.000 satır), çalışma sayfası ve başlık satırı seçimi, sütun eşleştirme, sınıf/grup varsayılanları ve çoklu servis.
- TC kontrol basamakları, dosya/veritabanı mükerrer TC, normalize edilmiş isim uyarısı, e-posta/tarih/bakiye ve servis doğrulaması.
- Önizlemeden sonra açık onay; hatalıları atlama ayrı seçimi; aynı isimler ancak ayrıca onayla aktarılır. Mevcut personel güncellenmez.
- CSV hata raporu; formül enjeksiyonuna karşı kaçış. Kayıt öncesi yeniden doğrulama ve transaction. Başarısız işlem kısmi kayıt bırakmaz.
- Kalıcı ayarlar ve işlem geçmişi PostgreSQL/Drizzle tablolarında.
- Günlük ilk kullanımda otomatik yedek, 5–365 son yedek saklama, elle yedek, SQL dışa aktarma, JSON dosyadan doğrulama/önizleme ve geri yükleme.
- Geri yükleme öncesi güvenlik yedeği; ilişkiler veya kayıtlar hatalıysa transaction geri alınır. Panel keyfi SQL çalıştırmaz.
- Yeni idempotent SQL şema güncellemesi. GitHub Pages şema parmak izi değiştiğinde eski verileri otomatik silme davranışı kaldırıldı.
- Panel içi bildirim tercihleri ve son işlemler. E-posta gönderimi iddia edilmez.
- Windows paketleri, sadece kendi PID’sini hedefleyen durdurma, yerel SQL yedek/geri dönüş, sağlık kontrollü güncelleme, kullanıcı yetkili kurulum ve GitHub Actions iş akışları.

## Test komutları

`npx next typegen`

`npx tsc --noEmit --pretty false`

`npm run build`

Çalışan yerel uygulamada:

`node scripts/test-settings-api.mjs`

`node scripts/test-settings-browser.mjs`

Tarayıcı veritabanı için (sunucu gerekmez):

`node scripts/pages-smoke-test.mjs`

Windows: `.github/workflows/windows-test.yml` ve `windows/README-WINDOWS.md`.

API testleri başlangıç yedeğini alır ve test sonunda eski verileri geri koyar. Tarayıcı testleri kurum ayarlarını geri koyar; aktarım önizlemesinde durur. Üretim veritabanında otomatik test çalıştırmayın; ayrı test veritabanı kullanın.

## Yeni şema sürümleri

Önce Drizzle `src/db/schema.ts` değişir. Veri silmeyen, tekrar çalıştırılabilir güncelleme `src/lib/schema-updates.ts` ve `windows/schema-update.sql` içine eklenir. İlk kurulum SQL’i `windows/schema.sql` ve indirme kopyası `public/database/personel26-schema.sql` aynı tutulur. Schema sürüm kaydı güncellenir. Mevcut veriyi sıfırlayarak güncelleme yapılmaz; önce yedek ve temiz kurulum/güncelleme testi çalıştırılır.

## Bilinen dağıtım sınırları

Bu ortam Linux olduğundan Windows installer testleri burada çalıştırılmadı. YAML ve test kodunun eklenmesi gerçek Windows testinin geçtiği anlamına gelmez. Değişikliklerin GitHub'a gönderilmesi ve Actions’ın başarılı tamamlanması gerekir. PATH izolasyonlu GitHub runner fiziksel temiz Windows değildir; Windows 10/11 standart kullanıcı, VC++ çalışma zamanı, SmartScreen/antivirüs, port çakışması ve çevrimdışı kullanım ayrıca kontrol edilmelidir.

Panelde kullanıcı girişi ve rol yetkisi yoktur; internet veya ortak yerel ağa açmadan önce bunlar eklenmelidir. TC maskeleme bir yetkilendirme kontrolü değildir. Aynı diskteki yedek harici kopyanın yerini tutmaz. Öneriler: rol bazlı erişim, dönem kilitleme, harici yedek hedefi. Bunlar panelde **öneri / henüz etkin değil** olarak ayrılmıştır.
