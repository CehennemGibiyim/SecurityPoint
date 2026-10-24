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

## Otomatik açılış ve günlük otomatik yedek

Ücretsizdir; yönetici yetkisi gerektirmez.

- **Kurulum sırasında**: kurulum sihirbazında *"Windows açılışında Personel26 otomatik başlatılsın"* ve *"Her gün 19:00'da otomatik SQL yedek alınsın"* seçenekleri varsayılan olarak işaretlidir. Kaldırma (Uninstall) bu ikisini de kendiliğinden temizler.
- **Elle açmak/kapatmak için** (kurulum yapmadan portable kullananlar dahil):

`powershell -NoProfile -ExecutionPolicy Bypass -File .\Personel26-Yonet.ps1 -Action AutoStart`

`powershell -NoProfile -ExecutionPolicy Bypass -File .\Personel26-Yonet.ps1 -Action AutoBackup`

Kapatmak için `AutoStartOff` / `AutoBackupOff`. Otomatik açılış, Windows otomatik başlangıç klasörüne gizli çalışan bir başlatıcı yazar; günlük yedek, saat 19:00'da `Personel26-Yonet.ps1 -Action Backup` çalıştırır ve SQL dosyaları `data/backups` içinde birikir.

## Kiosk modu (kapı terminali)

- **Personel26-Kiosk.bat** (Başlat menüsü: *Personel26 Kapı Kiosk (tam ekran)*) sunucuyu başlatır ve kapı terminalini Microsoft Edge'in kiosk (tam ekran, adres çubuksuz) modunda açar.
- Tarayıcı tarafı: `/terminal?kiosk=1` adresi ilk dokunuşta tam ekrana geçer (tarayıcılar etkileşimsiz tam ekrana izin vermez); ESC ile çıkılır.
- Edge yoksa varsayılan tarayıcıda aynı adres açılır; tam ekran için F11 kullanın.

## Yönetici girişi

Panel ve kapı terminali yönetici PIN'i ister (kullanıcı adı ve PIN panel ilk açıldığında sorulur; oturum 30 gün saklanır). Panel başlığındaki çıkış düğmesi veya terminaldeki *Çıkış* ile oturum kapatılır. PIN yalnızca karma (SHA-256) olarak paketlenir. Not: GitHub Pages (sunucusuz) sürümünde bu kapı yetkisiz göz atmayı engelleyen bir katmandır; kurum verisi tutan ortamlarda Windows (sunuculu) sürümü kullanın.

## Ücretsiz e-posta bildirimi (kendi SMTP hesabınızla)

**Ayarlar → Sistem → E-posta bildirimleri** alanından kendi e-posta hesabınızın SMTP bilgilerini girin (ücretsiz: Gmail *uygulama şifresi*, Outlook uygulama parolası vb.). İzin onay/red işlemlerinde ayarladığınız alıcıya bildirim gönderilir. İzin vermezseniz hiçbir e-posta gönderilmez; ek ücretli servis yoktur. Bu özellik sunuculu Windows sürümünde çalışır (GitHub Pages'de gönderim yapabilecek bir sunucu yoktur).

## Paket üretimi

Geliştirici makinesinde Node.js 22+ gerekir. Son kullanıcıda gerekmez.

`powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1`

Paketleyici tek dosyadır (`windows/paket-olustur.ps1`): tip üretimini, TypeScript ve üretim derlemesini kontrol eder; sabitlenmiş Node.js 22.22.3, PostgreSQL 16.13-1 x64 ve **Microsoft Visual C++ Redistributable** dosyalarını indirir. Node arşivi resmi SHA-256 ile, Visual C++ kurucusu Microsoft imzası ile doğrulanır. Geliştirme `.env` dosyaları çıkarılır. `manifest.json` sürüm ve arşiv hashlerini içerir. Ardından `installer.iss` dosyasını **kendi içinde üretir** ve Inno Setup 6 ile `Personel26-Kurulum.exe`'yi derler — Inno Setup kurulu değilse önce sessizce kurmayı dener (winget, sonra choco). Yalnızca taşınabilir paket için `-NoExe`, yalnızca ZIP için `-NoExe -NoZip` bayraklarını kullanın.

## Otomatik Windows testleri

`.github/workflows/windows-test.yml` main push, pull request ve elle tetikleme için hazırdır. Ayrı paketleme job'u çalışır; Windows 2022 ve 2025 job'larında **setup-node yoktur**. PATH yalnızca Windows sistem klasörleri ile sınırlandırılır, kurulu PostgreSQL servisleri durdurulur. Çalışan Node/PostgreSQL'in paket içinden geldiği doğrulanır.

Test senaryoları: sessiz kurulum, ilk açılış, gerçek veritabanı sağlık kontrolü, şema sürümü, SQL yedek/geri yükleme, başka Node süreçlerinin korunması, kapatma, yeniden açma, veri koruyan uygulama güncellemesi ve üzerine yeniden kurulum. Raporlar ve loglar Actions artifact'ine yazılır; parola dosyası ve SQL yedeği yüklenmez.

**Durum:** Bu geliştirme ortamı Linux'tur. Windows job'ları burada çalıştırılmadı ve başarılı oldukları iddia edilmez. Değişiklikleri GitHub'a gönderdikten sonra gerçek Actions sonuçlarını inceleyin. GitHub-hosted runner tam temiz son kullanıcı Windows'u değildir; PATH izolasyonu sistem araçlarına bağımlılığı test eder. Son dağıtım onayı için temiz Windows 10/11 sanal veya fiziksel makinede standart kullanıcı, Visual C++ çalışma zamanı, antivirüs/SmartScreen, çevrimdışı başlatma ve port çakışması kontrollerini ayrıca yapın.

## Veri güvenliği

Yerel diskteki yedek fiziksel arızaya karşı yeterli değildir: harici disk yedeği tutun. Panel ve kapı terminali yönetici PIN girişi ile korunur; rol bazlı yetkiler henüz yoktur. Yerel ağ veya internet erişimi vermeden önce rol bazlı yetkilendirme ve (internet için) TLS/arka uç kilidi eklenmelidir. GitHub Pages sürümü verileri sadece o tarayıcının IndexedDB alanında tutar; kurumun ortak çok kullanıcılı veritabanı yerine geçmez.
