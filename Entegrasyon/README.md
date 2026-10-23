# ORION FaceGate × Puantaj26 — Tek Klasörde Tam Birleşik Platform

Bu proje, **ORION FaceGate (`Face`)** biyometrik yüz tanımalı PDKS konsolu (tüm orijinal koyu-altın-camgöbeği arayüzü, görselleri, 3D canlılık destekli Biyometrik Stüdyosu, Yüz Terminali, Kapılar & Yetkiler altyapısı ve personel oluşturma akışı %100 korunarak) ile **Puantaj26 (`Personel26`)** resmi hastane/kurum nöbet, puantaj, maaş bordro, izin onay ve yedekleme sisteminin **tek bir klasör, tek bir veritabanı ve tek bir arayüz çatısı altında** birleştirilmiş tam sürümüdür.

---

## Birleştirme Mimarisi

1. **Tek Klasör, Tek Sunucu / Tek Çatı (`Face` + `Personel26` Birleşik)**:
   - İki ayrı port (`3000` ve `3001`) veya iki ayrı proje klasörü tamamen kaldırıldı; tüm sistem doğrudan kök dizinde tek uygulama olarak çalışır.
   - **ORION FaceGate** konsolunun sol menüsüne **Puantaj26 Resmi Sistem** başlığı altında tüm 12 resmi Puantaj26 modülü (`Puantaj Cetveli`, `Nöbet Çizelgesi`, `Maaş Bordro (Resmi)`, `Vardiya Şablonları`, `Servis & Kadro Yönetimi`, `Resmi İzin Onayları`, `Nöbet Değişimi (Takas)`, `Adalet Analizi`, `Mevzuat Uyarıları`, `Servis Duyuruları`, `Veri Yedekleme`, `Kurum & Sistem Ayarları`) ve `TC Personel Sorgu` ekranı doğrudan entegre edildi.
2. **Çift Yönlü Otomatik Personel & Birim Senkronizasyonu**:
   - **Face → Puantaj26**: `/personel` ekranından ("Yeni personel" → **"Kaydet ve Biyometrik Stüdyoyu Aç"**) oluşturulan veya güncellenen her personel (TC Kimlik No, Kadro Statüsü `MEMUR/HEMSIRE/ISCI`, Ekip Grubu `SAGLIK/DESTEK/TEKNISYEN`, birim ve biyometrik portre fotoğrafı dahil) otomatik olarak **Puantaj26** veritabanına aktarılır.
   - **Puantaj26 → Face**: Puantaj26 üzerinden eklenen veya Excel/CSV ile toplu aktarılan personeller de otomatik olarak **ORION FaceGate** personel kartlarına işlenir.
   - Resmi **Puantaj26** hesaplama motoru, ara dinlenme kuralları, resmi tatil/gece/fazla mesai formülleri, tek sayfa A4 imzalı çıktı düzeni (`PrintArea`), Excel çıktıları ve JSON/SQL yedek formatı **hiçbir bozulma olmadan %100 orijinal haliyle** korunmuştur.
3. **Tüm Görseller ve Yüz Tanıma Modelleri Dahil**:
   - `public/brand/orion-mark.png`, `public/scenes/{turnstile,gate,office,server}.jpg`, `public/portraits/*.jpg`, `public/vendor/face-api.min.js` ve `public/models/*` (tüm sinir ağı ağırlık `shard` dosyaları dahil) eksiksiz olarak proje içindedir.

---

## 1. GitHub Üzerinde Web Ortamında Çalıştırma (GitHub Pages — Sunucusuz!)

Depoyu `https://github.com/CehennemGibiyim/Entegrasyon` adresinin kök dizinine gönderdiğinizde `.github/workflows/` altındaki **3 otomatik iş akışı** devreye girer:

1. **GitHub Pages Web Yayını (`.github/workflows/pages.yml`)**:
   - GitHub deponuzda bir kez **Settings → Pages → Build and deployment → Source: `GitHub Actions`** seçin.
   - Her `push` sonrasında uygulama otomatik derlenir (`node scripts/pages-build.mjs`), tarayıcı içi gerçek PostgreSQL motoru (**PGlite / WASM + IndexedDB**) ile paketlenir ve doğrudan **`https://cehennemgibiyim.github.io/Entegrasyon/`** adresinde hem **ORION FaceGate** hem **Puantaj26** tüm özellikleriyle çalışır!
2. **Otomatik Windows Kurulum `.exe` & Taşınabilir `.zip` Üretimi (`.github/workflows/windows-test.yml`)**:
   - GitHub Actions üzerinde temiz Windows sunucularında hem **`Personel26-Kurulum.exe`** (Inno Setup kurulum sihirbazı — içinde gömülü Node.js 22 + PostgreSQL 16 ile hiçbir ek kurulum gerektirmeden çalışır) hem **`Personel26-Portable.zip`** otomatik üretilir ve **Actions → Artifacts (`windows-distribution`)** altından indirilebilir.
3. **Fullstack PostgreSQL & Tarayıcı Test Doğrulaması (`.github/workflows/validation.yml`)**:
   - Her değişiklikte gerçek PostgreSQL 16 + Puppeteer arayüz testleri + PGlite duman testlerini otomatik çalıştırır.

---

## 2. Windows Bilgisayarda Kurulum ve Çalıştırma

### Seçenek A — Sıfır Kurulumlu Kurulum Sihirbazı / Taşınabilir Paket (Önerilen)
- GitHub Actions **Actions → Windows paketleme ve kurulum testleri → `windows-distribution`** bölümünden indirdiğiniz **`Personel26-Kurulum.exe`** dosyasını çift tıklayarak kurun (veya kendi bilgisayarınızda üretmek için kök dizindeki **`KURULUM-EXE-OLUSTUR-WINDOWS.bat`** dosyasını çalıştırın).
- Masaüstüne gelen kısayol veya `Personel26-Baslat.bat` gömülü PostgreSQL 16 ve Node.js 22'yi otomatik başlatıp birleşik **ORION FaceGate × Puantaj26** ekranını açar.

### Seçenek B — Geliştirici Modunda Hızlı Başlatma
1. `.env.example` dosyasını `.env` olarak kopyalayıp `DATABASE_URL` bağlantınızı girin.
2. Kök dizindeki **`BASLAT-WINDOWS.bat`** dosyasına çift tıklayın (`http://localhost:3000`).
