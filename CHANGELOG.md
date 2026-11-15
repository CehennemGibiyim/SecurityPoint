# Değişiklik Günlüğü — SecurityPoint / ORION FaceGate × Puantaj26

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/).
Sürüm numarasının **tek kaynağı** `Entegrasyon/package.json` içindeki `version` alanıdır;
kurulum paketi, `manifest.json` ve arayüz bu değeri kullanır.

## [1.3.0] — 2026-11-15

### Eklenen
- **PWA (iOS + Android + masaüstü):** `manifest.webmanifest` (yeni `src/app/manifest.ts`), basePath'e
duyarlı service worker (`public/sw.js`), çevrimdışı sayfası ve üretimde otomatik kayıt
(`PwaRegister`). Panel "Ana Ekrana Ekle / Yükle" ile kurulabilir; API yanıtları önbelleğe alınmaz,
service worker yalnızca üretim derlemesinde kaydolur → mevcut davranış bozulmaz.
- **Linux taşınabilir paket:** `linux/paket-olustur.sh` gömülü Node.js + PostgreSQL ile
`SecurityPoint-Portable-linux-x64.tar.gz` üretir; başlat/durdur/yedekle/geri yükle/tanı/güncelle
betikleri, masaüstü kısayolu (`securitypoint.desktop`) ve `OKU-BENI.md` içerir.
- **Açılışta otomatik güncelleme (Windows + Linux):** yeni sürüm varsa paket indirilir, uygulama
değiştirilir, sağlık kontrolü yapılır; başarısız olursa **önceki sürüm geri alınır**. Güncelleme
denetimi 6 saatte bir yapılır, `autoUpdate` kapatılabilir (`AutoUpdateOff` / `autoupdate-off`).
- **Tanılama (`-Action Doctor` / `doctor`):** sürüm, dosya bütünlüğü, portlar, süreçler ve log
kuyruklarını `data/tanilama.txt` dosyasına yazar; Başlat menüsünde “SecurityPoint Tanılama” kısayolu.

### Değişen
- **Ürün adı her yerde SecurityPoint:** kurulum `.exe`'si, kısayollar, kaldırma girdisi, servis/görev
adları, betik dosya adları, panel başlığı, manifest ve Release başlıkları. `Puantaj26` modül adı korundu;
veritabanı adı/kullanıcısı (`personel26`) veri kaybı olmaması için değiştirilmedi.
- **Kurulum artık sessiz kalmıyor:** normal kurulumda uygulama başlatılır; başlatma başarısız olursa
Inno Setup ileti kutusu log/tanılama yollarını gösterir (sessiz kurulumda otomatik başlatma yok).
- **Port çakışması çözümü:** 3210/5433 doluysa boş port seçilip `connection.json`'a yazılır.
- **Tek ikon kaynağı:** eski `src/app/icon.svg` kaldırıldı; favicon.ico, apple-icon ve PWA simgeleri
`scripts/ikon-uret.py` ile aynı kaynaktan üretilir. 128/256 katmanları için netleştirme eklendi.

### Düzeltilen
- **Paketlenen statik varlıklar:** `.next/standalone/public` mevcut olduğu için `public` içeriği
`app/public/public/...` altına kopyalanıyordu; yüz modelleri, sahneler, `vendor/face-api.min.js`,
indirilebilir şema ve PWA dosyaları paketten **eksik** kalıyordu. Artık içerik birleştirilir (Windows + Linux).
- Kurulum sonrası ilk açılışta hata görünmüyordu; artık tüm başlatma hataları kaydedilir ve gösterilir.
- `-Action Doctor` ve `AutoUpdate` için yapılandırma okuma sırası sağlamlaştırıldı.

## [1.2.0] — 2026-11-15

### Eklenen
- **Uygulama ikonu:** `public/brand/orion-face-aurora.png` kaynağından 9 katmanlı (16–256 px)
  `securitypoint.ico` üreten tekrarlanabilir betik (`scripts/ikon-uret.py`). Kurulum `.exe`'si,
  Başlat menüsü/masaüstü kısayolları, kaldırma girdisi ve tarayıcı favicon'u aynı ikonu kullanır
  (`src/app/favicon.ico`, `src/app/apple-icon.png`).
- **Kurulum paketi kimliği:** Inno Setup'a `SetupIconFile`, `UninstallDisplayIcon` ve
  `VersionInfo*` alanları eklendi; `.exe` dosya özelliklerinde ürün adı, yayıncı ve sürüm görünür.
- **Sürüm tek kaynağı:** `package.json` `version` alanı; `paket-olustur.ps1` `-Version` parametresi
  (boşsa package.json okunur), `manifest.json` ve arayüz göstergesi aynı değeri kullanır.
- **Otomatik sürüm yayını:** `v*` etiketi itildiğinde `.github/workflows/release.yml`
  `SecurityPoint-Kurulum.exe` + `SecurityPoint-Portable.zip` ve `SHA256SUMS.txt` dosyalarını
  GitHub Release'e ekler.
- **Taşınabilir sessiz başlatıcı:** `windows/SecurityPoint-Baslat.vbs` — komut penceresi açmadan başlatır.
- **Port çakışması denetimi:** 3210 (uygulama) ve 5433 (PostgreSQL) portları başka bir uygulama
  tarafından kullanılıyorsa anlaşılır hata mesajı verilir.

### Değişen
- Kurulum sihirbazı kısayolları artık `.bat` yerine gizli pencerede `SecurityPoint-Yonet.ps1`
  çalıştırır (siyah konsol parlaması yok).
- Inno Setup: `MinVersion=10.0`, `ArchitecturesAllowed=x64compatible`, `SetupLogging=yes`,
  `UsePreviousAppDir=yes`, `AppVerName`.
- `package.json` kimliği: `personel26`, açıklama ve lisans alanları eklendi.
- PowerShell/`.bat`/`.vbs` dosyaları için `.gitattributes` ile CRLF sabitlendi.

### Güvenlik
- PostgreSQL arşivi için SHA-256 doğrulaması: `-PgSha256` verilirse zorunlu kontrol,
  verilmezse hesaplanan özet `manifest.json`'a yazılır ve sabitleme uyarısı basılır.
- Release varlıkları için `SHA256SUMS.txt` üretilir (imza yoksa doğrulama yolu).

## [1.1.0] — 2026-10-26
- Yönetici PIN kapısı, Windows otomatik başlatma/günlük yedek, kapı kiosk modu ve ücretsiz SMTP e-posta bildirimi.
- Uygulama içi kullanım kılavuzu ve 14 sayfalık sunum PDF'i; tek betikli Windows paketleme.
- GitHub Pages tarayıcı içi PostgreSQL (PGlite) yayını ve doğrulama iş akışları.
