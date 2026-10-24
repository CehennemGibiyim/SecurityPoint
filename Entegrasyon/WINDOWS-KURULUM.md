# Personel26 — Windows Kurulum Paketi

Bu belge, sistemi **Windows bilgisayarda kurulum veya USB/taşınabilir klasör** olarak çalıştırmak içindir.

Ayrıntılı adımlar, SSS ve klasör yapısı:
**[windows/README-WINDOWS.md](windows/README-WINDOWS.md)**

## Kısa özet

| Paket | Dosya | Kullanım |
| --- | --- | --- |
| Taşınabilir (önerilen) | `windows/paket-olustur.ps1` → `Personel26-Portable\` | Klasörü kopyala, `Personel26-Baslat.bat` çift tıkla. Kurulum gerekmez. |
| Kurulum (.exe) | `windows/paket-olustur.ps1` → `Personel26-Kurulum.exe` | Tek betik hem portable paketi hem .exe'yi üretir. Klasik İleri–İleri–Bitir kurulumu, masaüstü kısayolu. |

> Tek komut her şeyi yapar: derleme, portable paket, ZIP, `installer.iss` üretimi ve Inno Setup ile .exe derleme. Inno Setup kurulu değilse betik önce sessizce kurmayı dener; Visual C++ Redistributable pakete gömülüdür, temiz Windows'ta kurulum sırasında veya ilk açılışta kendiliğinden kurulur.

## Taşınabilir paketi üretmek (geliştirici PC)

Windows’ta Node.js kurulu olmalı. Proje klasöründe:

```powershell
powershell -ExecutionPolicy Bypass -File windows\paket-olustur.ps1
```

Çıktı:

- `Personel26-Portable\` — USB’ye kopyalanabilir klasör
- `Personel26-Portable.zip` — arşiv
- `windows\Personel26-Kurulum.exe` — kurulum dosyası (Inno Setup yoksa betik kendisi kurmayı dener)

Hedef PC’de **`Personel26-Baslat.bat`** çalıştırın. İlk açılışta veritabanı otomatik kurulur; tarayıcı `http://127.0.0.1:3210` adresini açar. Durdurmak için `Personel26-Durdur.bat`.

Verileriniz `data\` klasöründedir. Yedek = bu klasörü kopyalamak.

## GitHub’dan web sitesi olarak yayınlama

- **GitHub Pages** → arayüzün tanıtım sayfası (hazır iş akışı: `.github/workflows/pages.yml`)
- **Vercel + Neon** → canlı, veritabanlı tam sistem (ücretsiz katman)

Adım adım anlatım: **[WEB-YAYINLAMA.md](WEB-YAYINLAMA.md)**
