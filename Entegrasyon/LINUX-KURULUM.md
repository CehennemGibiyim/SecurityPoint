# SecurityPoint — Linux Kurulum Paketi

Bu belge, sistemi **Linux masaüstü/sunucuda taşınabilir klasör** olarak çalıştırmak içindir.
Ayrıntılı kullanım: paket içindeki **[OKU-BENI.md](linux/OKU-BENI.md)**.

## İndirme

GitHub → **Releases** → `v1.3.0` → `SecurityPoint-Portable-linux-x64.tar.gz` (+ `SHA256SUMS.txt`).

```bash
sha256sum -c SecurityPoint-Portable-linux-x64.tar.gz.sha256   # bütünlük doğrulama
tar -xzf SecurityPoint-Portable-linux-x64.tar.gz
cd SecurityPoint-Portable
./SecurityPoint-Baslat.sh
```

Sistemde Node.js veya PostgreSQL kurulu olmak zorunda değildir; `sudo`/`apt` gerekmez.
Panel `http://127.0.0.1:3210` adresinde açılır.

## Paket içeriği

| Yol | Açıklama |
| --- | --- |
| `app/` | Next.js standalone uygulaması (statik varlıklar dahil) |
| `node/bin/node` | Gömülü Node.js 22 (resmi SHA-256 ile doğrulanmış) |
| `pgsql/` | Gömülü PostgreSQL 16 (`bin`, `lib`, `share` + gerekli çalışma zamanı kütüphaneleri) |
| `SecurityPoint-Baslat.sh` / `-Durdur.sh` / `-Yedekle.sh` | Günlük kullanım |
| `SecurityPoint-Yonet.sh` | `start/stop/kiosk/backup/restore/update/doctor/autoupdate-on/off` |
| `securitypoint.desktop` + `brand/securitypoint.png` | Masaüstü/menü kısayolu |
| `schema.sql`, `schema-update.sql` | İlk kurulum ve veri silmeyen şema güncellemesi |

## Üretim (geliştirici / CI)

```bash
cd Entegrasyon
npm ci && npx next typegen && npx tsc --noEmit && npm run build
./linux/paket-olustur.sh --skip-build --pg-dir /usr/lib/postgresql/16
```

- PostgreSQL çalıştırıcıları `--pg-dir` altından alınır (CI'da PGDG `postgresql-16` kurulur).
  İkili dosyaların `glibc` dışındaki paylaşılan kütüphane bağımlılıkları `pgsql/lib` içine kopyalanır.
- Node.js arşivi resmi `SHASUMS256.txt` ile doğrulanır.
- Sürüm `package.json` üzerinden alınır; `manifest.json` içine yazılır.
- Paket `ubuntu-22.04` üzerinde üretilir: glibc 2.35+ dağıtımlarla uyumludur (x86_64).

## Veri, güvenlik ve sınırlar

- Veriler `data/` içinde: `data/pgdata` (veritabanı), `data/backups` (SQL yedekleri).
- PostgreSQL yalnızca `127.0.0.1` dinler; parola `data/connection.json` içinde `600` izinle tutulur.
- 3210/5433 doluysa başlatıcı boş port seçer ve `connection.json`'a yazar.
- ARM64 paket yoktur; gerekirse CI'da ayrıca üretilmelidir.
- Saf sunucuda masaüstü ortamı bulunmaz; tarayıcı açılmaz, adresi elle açın (`P26_NO_BROWSER=1`).
- Yerel ağa/internete açmadan önce TLS'li ters vekil ve rol bazlı yetkilendirme ekleyin.
