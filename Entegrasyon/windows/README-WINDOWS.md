# Personel26 — Windows 1.1.0

## Son kullanıcı

Node.js ve PostgreSQL ayrıca kurulmaz: paket kendi Windows x64 çalıştırıcılarını içerir. Kurulum kullanıcı klasörüne yapılır ve yönetici yetkisi gerektirmez.

- **Personel26-Baslat.bat**: veritabanını ilk kullanımda kurar, veri silmeyen şema güncellemelerini uygular, sunucuyu başlatır ve tarayıcıyı açar.
- **Personel26-Durdur.bat**: sadece paketin PID dosyasındaki, yolu doğrulanmış Node sürecini ve kendi PostgreSQL kümesini kapatır. Diğer Node uygulamalarını kapatmaz.
- **Personel26-Yedekle.bat**: `data/backups` içine yerel PostgreSQL SQL yedeği oluşturur.
- Panelde **Ayarlar → Yedekleme & Veritabanı**: JSON yedeği, SQL dışa aktarma, doğrulanmış dosyadan geri yükleme ve şema güncelleme.

Adres: `http://127.0.0.1:3210`. PostgreSQL yalnızca `127.0.0.1:5433` üzerinde dinler. İlk kurulumda rastgele veritabanı parolası üretilir ve mevcut kullanıcıya özel izinlerle `data/connection.json` içinde saklanır. Bu dosyayı paylaşmayın.

## SQL şema ile veri yedeği farklıdır

- `schema.sql`: boş veritabanının ilk kurulumu; tabloları oluşturur, kullanıcı verisi içermez. Boş veritabanında bir kez uygulanır.
- `schema-update.sql`: mevcut verileri koruyarak yeni sütunları ve tabloları ekler. Tekrar çalıştırılabilir. Her başlatmada uygulanır.
- Panelden indirilen veri SQL'i: uyumlu şema üzerine uygulama verilerini geri koyar. Önce yedek alır, uygulamayı kapatır ve yalnızca güvenilir dosyaları kullanırsınız.
- `Personel26-Yedekle.bat` ile alınan SQL: `pg_dump --clean --if-exists` çıktısı; şema ve verileri içerir. Yerel PostgreSQL aracına geri verilebilir.

SQL geri yükleme (uygulama klasöründe PowerShell):

`powershell -NoProfile -ExecutionPolicy Bypass -File .\Personel26-Yonet.ps1 -Action Restore -BackupFile "D:\Yedek\personel26.sql"`

Önce otomatik güvenlik yedeği alınır. SQL tek transaction ile çalıştırılır; başarısız olursa mevcut veriler korunur. Geri yükleme sonrasında şema güncellemesi tekrar uygulanır. Panel üzerinden SQL çalıştırılmaz: panel JSON dosyasını doğrular ve önizler.

## Güncelleme

Önce tüm dosyalarınızı ve `data` klasörünü harici diske yedekleyin. Yeni kurulum dosyası mevcut aynı kullanıcı klasörüne kurulduğunda `data` klasörü korunur. Uygulama yeniden başlatıldığında `schema-update.sql` uygulanır.

Alternatif olarak yeni portable klasörünü kullanın:

`powershell -NoProfile -ExecutionPolicy Bypass -File .\Personel26-Yonet.ps1 -Action Update -PackagePath "D:\YeniSurum\Personel26-Portable"`

Bu akış SQL güvenlik yedeği alır, yalnızca uygulamayı değiştirir ve sağlık kontrolü yapar. Başlatma başarısızsa eski uygulama klasörü geri alınır. Bu güncelleme PostgreSQL ana sürümünü değiştirmez; 16→17 gibi geçişler ayrıca `pg_upgrade` / yedekten taşıma ile planlanmalıdır. Kaldırma sırasında `data` klasörü otomatik silinmez.

## Paket üretimi

Geliştirici makinesinde Node.js 22+ gerekir. Son kullanıcıda gerekmez.

`powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1`

Paketleyici tip üretimi, TypeScript ve üretim derlemesini kontrol eder; sabitlenmiş Node.js 22.22.3 ve PostgreSQL 16.13-1 x64 dosyalarını indirir. Node arşivi resmi SHA-256 ile doğrulanır. Geliştirme `.env` dosyaları çıkarılır. `manifest.json` sürüm ve arşiv hashlerini içerir. Ardından Inno Setup 6 ile `windows/installer.iss` derlenir.

## Otomatik Windows testleri

`.github/workflows/windows-test.yml` main push, pull request ve elle tetikleme için hazırdır. Ayrı paketleme job'u çalışır; Windows 2022 ve 2025 job'larında **setup-node yoktur**. PATH yalnızca Windows sistem klasörleri ile sınırlandırılır, kurulu PostgreSQL servisleri durdurulur. Çalışan Node/PostgreSQL'in paket içinden geldiği doğrulanır.

Test senaryoları: sessiz kurulum, ilk açılış, gerçek veritabanı sağlık kontrolü, şema sürümü, SQL yedek/geri yükleme, başka Node süreçlerinin korunması, kapatma, yeniden açma, veri koruyan uygulama güncellemesi ve üzerine yeniden kurulum. Raporlar ve loglar Actions artifact'ine yazılır; parola dosyası ve SQL yedeği yüklenmez.

**Durum:** Bu geliştirme ortamı Linux'tur. Windows job'ları burada çalıştırılmadı ve başarılı oldukları iddia edilmez. Değişiklikleri GitHub'a gönderdikten sonra gerçek Actions sonuçlarını inceleyin. GitHub-hosted runner tam temiz son kullanıcı Windows'u değildir; PATH izolasyonu sistem araçlarına bağımlılığı test eder. Son dağıtım onayı için temiz Windows 10/11 sanal veya fiziksel makinede standart kullanıcı, Visual C++ çalışma zamanı, antivirüs/SmartScreen, çevrimdışı başlatma ve port çakışması kontrollerini ayrıca yapın.

## Veri güvenliği

Yerel diskteki yedek fiziksel arızaya karşı yeterli değildir: harici disk yedeği tutun. Mevcut panelde kullanıcı girişi/rol kontrolü yoktur. Yerel ağ veya internet erişimi vermeden önce kimlik doğrulama, yetkilendirme ve TLS eklenmelidir. GitHub Pages sürümü verileri sadece o tarayıcının IndexedDB alanında tutar; kurumun ortak çok kullanıcılı veritabanı yerine geçmez.
