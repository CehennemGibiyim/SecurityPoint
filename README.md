# SecurityPoint — ORION FaceGate × Puantaj26

Kapı geçiş (biyometrik yüz tanıma) + PDKS / puantaj paneli. Tek depoda üç parça barındırır:
**çalışan Next.js uygulaması**, **eski sürüm arşivi** ve **GitHub Actions iş akışları**.

> 🌐 Canlı panel (GitHub Pages): **https://cehennemgibiyim.github.io/SecurityPoint/**
> ⚠ Tek seferlik ayar: **Settings → Pages → Source = GitHub Actions** (branch değil).

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
│   ├── windows/           → Windows paketleme (.ps1, .iss, Başlat/Durdur/Yedekle .bat)
│   └── public/            → bayrak, modeller, sahneler (face-api ağırlıkları dahil)
├── Personel26/            ← eski tek-dosya sürüm (arşiv — dokunulmaz)
└── artifacts/             ← yerel çalışma artıkları (git'e girmez, .gitignore'da)
```

## Nasıl çalışıyor?

- **Web (GitHub Pages):** `pages.yml` → `Entegrasyon/scripts/pages-build.mjs` hem Next.js'i
  statik dışa aktarır hem de panelin API katmanını `_site/pglite/app.js` olarak tarayıcıya
  paketler. PostgreSQL (WASM) tarayıcıda çalışır, veriler IndexedDB'de saklanır — sunucu gerekmez.
- **Windows:** `windows-test.yml` → `windows/paket-olustur.ps1` .next/standalone + Node.js +
  PostgreSQL ikililerini taşınabilir pakete gömer; `installer.iss` de kurulum .exe'sini üretir.
- **Doğrulama:** `validation.yml` gerçek PostgreSQL servisi üzerinde typecheck, build, API ve
  tarayıcı köprüsü testlerini çalıştırır.

## Yerel geliştirme (Entegrasyon/ altında)

```bash
npm install
npm run dev            # sunuculu geliştirme (API rotaları, PostgreSQL gerekir)
npm run pages:build    # GitHub Pages derlemesi → _site/
npm run pages:serve    # statik siteyi yerelde dene → http://127.0.0.1:4173
npm run build          # üretim derlemesi (standalone — Windows paketi bundan üretilir)
```
