# Personel26 — Windows Kurulum Paketi

Bu belge, sistemi **Windows bilgisayarda kurulum veya USB/taşınabilir klasör** olarak çalıştırmak içindir.

Ayrıntılı adımlar, SSS ve klasör yapısı:
**[windows/README-WINDOWS.md](windows/README-WINDOWS.md)**

## Kısa özet

| Paket | Dosya | Kullanım |
| --- | --- | --- |
| Taşınabilir (önerilen) | `windows/paket-olustur.ps1` → `Personel26-Portable\` | Klasörü kopyala, `Personel26-Baslat.bat` çift tıkla. Kurulum gerekmez. |
| Kurulum (.exe) | `windows/installer.iss` (Inno Setup) → `Personel26-Kurulum.exe` | Klasik İleri–İleri–Bitir kurulumu, masaüstü kısayolu |

## Taşınabilir paketi üretmek (geliştirici PC)

Windows’ta Node.js kurulu olmalı. Proje klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
```

Çıktı:

- `Personel26-Portable\` — USB’ye kopyalanabilir klasör
- `Personel26-Portable.zip` — arşiv

Hedef PC’de **`Personel26-Baslat.bat`** çalıştırın. İlk açılışta veritabanı otomatik kurulur; tarayıcı `http://127.0.0.1:3210` adresini açar. Durdurmak için `Personel26-Durdur.bat`.

Verileriniz `data\` klasöründedir. Yedek = bu klasörü kopyalamak.

## GitHub’dan web sitesi olarak yayınlama

- **GitHub Pages** → arayüzün tanıtım sayfası (hazır iş akışı: `.github/workflows/pages.yml`)
- **Vercel + Neon** → canlı, veritabanlı tam sistem (ücretsiz katman)

Adım adım anlatım: **[WEB-YAYINLAMA.md](WEB-YAYINLAMA.md)**
