# Değişiklik Günlüğü — Personel26 / ORION FaceGate × Puantaj26

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) · Sürümleme: [SemVer](https://semver.org/lang/tr/).
Sürüm numarasının **tek kaynağı** `Entegrasyon/package.json` içindeki `version` alanıdır;
kurulum paketi, `manifest.json` ve arayüz bu değeri kullanır.

## [1.2.0] — 2026-11-15

### Eklenen
- **Uygulama ikonu:** `public/brand/orion-face-aurora.png` kaynağından 9 katmanlı (16–256 px)
  `personel26.ico` üreten tekrarlanabilir betik (`scripts/ikon-uret.py`). Kurulum `.exe`'si,
  Başlat menüsü/masaüstü kısayolları, kaldırma girdisi ve tarayıcı favicon'u aynı ikonu kullanır
  (`src/app/favicon.ico`, `src/app/apple-icon.png`).
- **Kurulum paketi kimliği:** Inno Setup'a `SetupIconFile`, `UninstallDisplayIcon` ve
  `VersionInfo*` alanları eklendi; `.exe` dosya özelliklerinde ürün adı, yayıncı ve sürüm görünür.
- **Sürüm tek kaynağı:** `package.json` `version` alanı; `paket-olustur.ps1` `-Version` parametresi
  (boşsa package.json okunur), `manifest.json` ve arayüz göstergesi aynı değeri kullanır.
- **Otomatik sürüm yayını:** `v*` etiketi itildiğinde `.github/workflows/release.yml`
  `Personel26-Kurulum.exe` + `Personel26-Portable.zip` ve `SHA256SUMS.txt` dosyalarını
  GitHub Release'e ekler.
- **Taşınabilir sessiz başlatıcı:** `windows/Personel26-Baslat.vbs` — komut penceresi açmadan başlatır.
- **Port çakışması denetimi:** 3210 (uygulama) ve 5433 (PostgreSQL) portları başka bir uygulama
  tarafından kullanılıyorsa anlaşılır hata mesajı verilir.

### Değişen
- Kurulum sihirbazı kısayolları artık `.bat` yerine gizli pencerede `Personel26-Yonet.ps1`
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
