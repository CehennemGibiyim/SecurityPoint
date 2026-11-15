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
│   └── windows-test.yml   → portable .zip + Inno Setup .exe üretir (Actions → Artifacts)
├── Entegrasyon/           ← AKTİF uygulama (Next.js, tüm workflow adımları burada çalışır)
│   ├── src/               → panel kaynak kodu (app router, API, bileşenler)
│   ├── scripts/           → pages-build / duman testi / yerel sunucu betikleri
│   ├── windows/           → Windows kurulum paketi (tek betik: paket-olustur.ps1 + Başlat/Durdur/Yedekle)
│   └── public/            → bayrak, modeller, sahneler (face-api ağırlıkları dahil)
└── .gitignore
```

## Nasıl çalışıyor?

- **Web (GitHub Pages):** `pages.yml` → `Entegrasyon/scripts/pages-build.mjs` hem Next.js'i
  statik dışa aktarır hem de panelin API katmanını `_site/pglite/app.js` olarak tarayıcıya
  paketler. PostgreSQL (WASM) tarayıcıda çalışır, veriler IndexedDB'de saklanır — sunucu gerekmez.
- **Windows:** `windows-test.yml` → `windows/paket-olustur.ps1` tek başına her şeyi üretir:
  .next/standalone + Node.js + PostgreSQL + Visual C++ taşınabilir pakete gömülür, `installer.iss`
  kendi içinde üretilir ve Inno Setup 6 ile kurulum .exe'si derlenir (Inno Setup yoksa sessizce kurulur).
- **Doğrulama:** `validation.yml` gerçek PostgreSQL servisi üzerinde typecheck, build, API ve
  tarayıcı köprüsü testlerini çalıştırır.

## Sürüm yayını

- **Sürüm numarasının tek kaynağı:** `Entegrasyon/package.json` → `version`. Kurulum `.exe`'sinin dosya özellikleri, `manifest.json`, README ve paneldeki sürüm göstergesi bu değerden üretilir; elle çoğaltılmaz.
- **Uygulama ikonu:** `Entegrasyon/public/brand/personel26.ico` — 9 katmanlı (16–256 px), `scripts/ikon-uret.py` ile `orion-face-aurora.png` kaynağından üretilir. Kurulum `.exe`'si, Başlat menüsü/masaüstü kısayolları, kaldırma girdisi ve tarayıcı favicon'u aynı ikonu kullanır.
- **Otomatik yayın:** `git tag v1.2.0 && git push origin v1.2.0` → `.github/workflows/release.yml` derler ve **GitHub Release**'e `Personel26-Kurulum.exe`, `Personel26-Portable.zip` ve `SHA256SUMS.txt` ekler.
- **Değişiklikler:** [CHANGELOG.md](CHANGELOG.md).
- İndirilen dosyanın bütünlüğü: `Get-FileHash .\Personel26-Kurulum.exe -Algorithm SHA256` (özet `SHA256SUMS.txt` ile karşılaştırılır). Kurulum dosyası kod imzalı değildir; SmartScreen ilk çalıştırmada uyarı gösterebilir.

## Yerel geliştirme (Entegrasyon/ altında)

```bash
npm install
npm run dev            # sunuculu geliştirme (API rotaları, PostgreSQL gerekir)
npm run pages:build    # GitHub Pages derlemesi → _site/
npm run pages:serve    # statik siteyi yerelde dene → http://127.0.0.1:4173
npm run build          # üretim derlemesi (standalone — Windows paketi bundan üretilir)
```
