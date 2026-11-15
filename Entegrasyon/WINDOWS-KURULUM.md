# SecurityPoint — Windows Kurulum Paketi

Bu belge, sistemi **Windows bilgisayarda kurulum veya USB/taşınabilir klasör** olarak çalıştırmak içindir.

Ayrıntılı adımlar, SSS ve klasör yapısı:
**[windows/README-WINDOWS.md](windows/README-WINDOWS.md)**

## Kısa özet

| Paket | Dosya | Kullanım |
| --- | --- | --- |
| Taşınabilir (önerilen) | `windows/paket-olustur.ps1` → `SecurityPoint-Portable\` | Klasörü kopyala, `SecurityPoint-Baslat.vbs` (penceresiz) veya `SecurityPoint-Baslat.bat` çift tıkla. Kurulum gerekmez. |
| Kurulum (.exe) | `windows/paket-olustur.ps1` → `SecurityPoint-Kurulum.exe` | Tek betik hem portable paketi hem .exe'yi üretir. Klasik İleri–İleri–Bitir kurulumu, masaüstü kısayolu. |

> Sürüm numarası `package.json` içindeki `version` alanından gelir; ikon `public/brand/securitypoint.ico` dosyasından alınır (kısayollar, `.exe` ve tarayıcı sekmesi aynı ikonu kullanır).
>
> Tek komut her şeyi yapar: derleme, portable paket, ZIP, `installer.iss` üretimi ve Inno Setup ile .exe derleme. Inno Setup kurulu değilse betik önce sessizce kurmayı dener; Visual C++ Redistributable pakete gömülüdür, temiz Windows'ta kurulum sırasında veya ilk açılışta kendiliğinden kurulur.

## Taşınabilir paketi üretmek (geliştirici PC)

Windows’ta Node.js kurulu olmalı. Proje klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
```

Çıktı:

- `SecurityPoint-Portable\` — USB’ye kopyalanabilir klasör
- `SecurityPoint-Portable.zip` — arşiv
- `windows\SecurityPoint-Kurulum.exe` — kurulum dosyası (Inno Setup yoksa betik kendisi kurmayı dener)

Yayınlanan sürümü indirmek için: depo → **Releases** (`v1.2.0`) → `SecurityPoint-Kurulum.exe` / `SecurityPoint-Portable.zip` + `SHA256SUMS.txt`.

Hedef PC’de **`SecurityPoint-Baslat.bat`** çalıştırın. İlk açılışta veritabanı otomatik kurulur; tarayıcı `http://127.0.0.1:3210` adresini açar. Durdurmak için `SecurityPoint-Durdur.bat`.

Verileriniz `data\` klasöründedir. Yedek = bu klasörü kopyalamak.

## GitHub’dan web sitesi olarak yayınlama

- **GitHub Pages** → arayüzün tanıtım sayfası (hazır iş akışı: `.github/workflows/pages.yml`)
- **Vercel + Neon** → canlı, veritabanlı tam sistem (ücretsiz katman)

Adım adım anlatım: **[WEB-YAYINLAMA.md](WEB-YAYINLAMA.md)**
