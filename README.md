# SecurityPoint — ORION FaceGate × Puantaj26
https://github.com/CehennemGibiyim/SecurityPoint/actions/runs/40246927388/artifacts/12619385433
Kapı geçiş (biyometrik yüz tanıma) + PDKS / puantaj paneli. Tek depoda iki parça barındırır:
**çalışan Next.js uygulaması** ve **GitHub Actions iş akışları**.

> 🌐 Canlı panel (GitHub Pages): **https://cehennemgibiyim.github.io/SecurityPoint/**
> ⚠ Tek seferlik ayar: **Settings → Pages → Source = GitHub Actions** (branch değil).
> 📊 **Tanıtım sunumu (PDF):** [docs/SecurityPoint-Sunum.pdf](docs/SecurityPoint-Sunum.pdf) — menü menü anlatım, ekranlar, kurulum ve güvenlik sayfalarıyla 14 sayfalık pazarlama/kullanım sunumu.
> 📖 **Uygulama içi kullanım kılavuzu:** panelde sol menü → **Yardım → Kullanım Kılavuzu** (`/yardim`).

## Depo yapısı

```
SecurityPoint/
├── .github/workflows/     ← CI buralarda (DEPO KÖKÜ zorunlu — GitHub kök dışını çalıştırmaz)
│   ├── pages.yml          → statik paneli derler, GitHub Pages'e yayınlar
│   ├── validation.yml     → typecheck + build + API/Pages köprü testleri (PostgreSQL servisiyle)
│   ├── windows-test.yml   → portable .zip + Inno .exe üretir ve kurulumu test eder
│   └── release.yml        → v* etiketinde Windows + Linux paketlerini GitHub Release'e ekler
├── Entegrasyon/           ← AKTİF uygulama (Next.js, tüm workflow adımları burada çalışır)
│   ├── src/               → panel kaynak kodu (app router, API, bileşenler)
│   ├── scripts/           → pages-build / duman testi / yerel sunucu betikleri
│   ├── windows/           → Windows paketi (paket-olustur.ps1 + Başlat/Durdur/Yedekle/Tanılama)
│   ├── linux/             → Linux paketi (paket-olustur.sh + aynı betikler + .desktop kısayolu)
│   └── public/            → modeller, sahneler, ikonlar, sw.js, offline.html
└── .gitignore
```

## Nasıl çalışıyor?

- **Web (GitHub Pages):** `pages.yml` → `Entegrasyon/scripts/pages-build.mjs` hem Next.js'i
  statik dışa aktarır hem de panelin API katmanını `_site/pglite/app.js` olarak tarayıcıya
  paketler. PostgreSQL (WASM) tarayıcıda çalışır, veriler IndexedDB'de saklanır — sunucu gerekmez.
- **Windows:** `windows-test.yml` → `windows/paket-olustur.ps1` tek başına her şeyi üretir:
  .next/standalone + Node.js + PostgreSQL + Visual C++ taşınabilir pakete gömülür, `installer.iss`
  kendi içinde üretilir ve Inno Setup 6 ile kurulum .exe'si derlenir (Inno Setup yoksa sessizce kurulur).
- **Linux:** `linux/paket-olustur.sh` aynı Next.js çıktısını gömülü Node.js + PostgreSQL ile
  `SecurityPoint-Portable-linux-x64.tar.gz` olarak paketler (başlat/durdur/yedekle/geri yükle/tanı).
- **PWA (iOS + Android + masaüstü):** `src/app/manifest.ts` + `public/sw.js`. Panel tarayıcıdan
  "Ana Ekrana Ekle / Yükle" ile kurulur. Service worker yalnızca üretimde kaydolur, API yanıtlarını
  önbelleğe almaz; çevrimdışıyken `offline.html` gösterilir. Sunuculu sürümde PWA tam işlevlidir;
  GitHub Pages sürümünde veriler tarayıcıda (PGlite/IndexedDB) kalır.
- **Doğrulama:** `validation.yml` gerçek PostgreSQL servisi üzerinde typecheck, build, API ve
  tarayıcı köprüsü testlerini çalıştırır.

## Sürüm yayını

- **Sürüm numarasının tek kaynağı:** `Entegrasyon/package.json` → `version`. Kurulum `.exe`'sinin dosya özellikleri, `manifest.json`, README ve paneldeki sürüm göstergesi bu değerden üretilir; elle çoğaltılmaz.
- **Uygulama ikonu — tek kaynak:** `Entegrasyon/public/brand/securitypoint.ico` (9 katman, 16–256 px) `scripts/ikon-uret.py` ile `orion-face-aurora.png` kaynağından üretilir. Aynı betik `src/app/favicon.ico`, `src/app/apple-icon.png` ve PWA PNG'lerini yazar; eski `src/app/icon.svg` kaldırıldı. Kurulum `.exe`'si, kısayollar, kaldırma girdisi, tarayıcı sekmesi ve PWA aynı ikonu kullanır.
- **Otomatik yayın:** `git tag v1.3.0 && git push origin v1.3.0` → `.github/workflows/release.yml` Windows ve Linux paketlerini derler ve **GitHub Release**'e `SecurityPoint-Kurulum.exe`, `SecurityPoint-Portable.zip`, `SecurityPoint-Portable-linux-x64.tar.gz` ve `SHA256SUMS.txt` ekler.
- **Değişiklikler:** [CHANGELOG.md](CHANGELOG.md).
- İndirilen dosyanın bütünlüğü: `Get-FileHash .\SecurityPoint-Kurulum.exe -Algorithm SHA256` (özet `SHA256SUMS.txt` ile karşılaştırılır). Kurulum dosyası kod imzalı değildir; SmartScreen ilk çalıştırmada uyarı gösterebilir.

## Kurulum çalışmazsa (Windows)

1. Başlat menüsü → **SecurityPoint Tanılama** (veya `powershell -ExecutionPolicy Bypass -File .\SecurityPoint-Yonet.ps1 -Action Doctor`) → `data\tanilama.txt` üretir.
2. `data\baslatma-hatasi.txt`, `data\app-error.log` ve `data\postgres.log` dosyalarına bakın.
3. Normal kurulumda başlatma hatası artık ileti kutusuyla gösterilir; sessiz kurulumda otomatik başlatma yapılmaz.
4. 3210/5433 portları doluysa uygulama boş port seçip `data\connection.json`'a yazar; adres `data\connection.json` içindeki `appPort` değeridir.
5. Yeni sürüm varsa uygulama açılışta kendi kendine güncellenir (hata olursa önceki sürüme döner). Kapatmak için: `-Action AutoUpdateOff`.

## Yerel geliştirme (Entegrasyon/ altında)

```bash
npm install
npm run dev            # sunuculu geliştirme (API rotaları, PostgreSQL gerekir)
npm run pages:build    # GitHub Pages derlemesi → _site/
npm run pages:serve    # statik siteyi yerelde dene → http://127.0.0.1:4173
npm run build          # üretim derlemesi (standalone — Windows/Linux paketleri bundan üretilir)
python3 scripts/ikon-uret.py   # ikon + PWA simgelerini yeniden üret (Pillow gerekir)
./linux/paket-olustur.sh --skip-build --pg-dir /usr/lib/postgresql/16   # Linux paketi
./windows/paket-olustur.ps1    # Windows paketi (Windows'ta)
```
