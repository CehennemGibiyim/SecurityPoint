# SecurityPoint — Linux taşınabilir paket

Bu klasör kendi Node.js ve PostgreSQL çalıştırıcılarını içerir. Sistemde Node.js veya
PostgreSQL kurulu olmak zorunda değildir; `apt`/`sudo` gerekmez.

## İlk çalıştırma

```bash
tar -xzf SecurityPoint-Portable-linux-x64.tar.gz
cd SecurityPoint-Portable
./SecurityPoint-Baslat.sh
```

Panel `http://127.0.0.1:3210` adresinde açılır. İlk açılışta veritabanı oluşturulur,
veri silmeyen şema güncellemesi uygulanır ve tarayıcı açılır.

## Betikler

| Betik | İş |
| --- | --- |
| `SecurityPoint-Baslat.sh` | Veritabanını hazırlar, sunucuyu başlatır, tarayıcıyı açar. |
| `SecurityPoint-Durdur.sh` | Yalnızca bu paketin Node sürecini ve kendi PostgreSQL kümesini kapatır. |
| `SecurityPoint-Yedekle.sh` | `data/backups` içine SQL yedeği alır. |
| `SecurityPoint-Yonet.sh doctor` | Tanılama raporu üretir (`data/tanilama.txt`). |
| `SecurityPoint-Yonet.sh kiosk` | Kapı terminalini tam ekran açar. |
| `SecurityPoint-Yonet.sh update <klasör>` | Yeni paketi uygular; hata olursa geri alır. |
| `SecurityPoint-Yonet.sh autoupdate-on/off` | Açılışta güncelleme denetimini açar/kapatır. |

Masaüstü kısayolu: `securitypoint.desktop` (ikon: `brand/securitypoint.png`).

## Veri ve güvenlik

- Veriler `data/` içindedir (`data/pgdata` veritabanı, `data/backups` yedekler).
  Yedek = bu klasörü harici diske kopyalamak.
- PostgreSQL yalnızca `127.0.0.1` üzerinde dinler; rastgele parola `data/connection.json`
  içinde `600` izinle saklanır. Bu dosyayı paylaşmayın.
- 3210/5433 portları doluysa başlatıcı boş bir port seçer ve `connection.json`'a yazar.
- Panel ve kapı terminali yönetici PIN'i ister; rol bazlı yetki yoktur. Yerel ağa veya
  internete açmadan önce ters vekil (TLS) ve ek yetkilendirme ekleyin.

## Güncelleme

Açılışta (`autoUpdate` açıksa ve son denetimden 6 saat geçtiyse) GitHub Releases'te yeni sürüm
aranır. Bulunursa `SecurityPoint-Portable-linux-x64.tar.gz` indirilir, uygulama klasörü
değiştirilir, sağlık kontrolü yapılır; başarısız olursa önceki sürüm geri yüklenir.
Elle güncelleme için: `./SecurityPoint-Yonet.sh update /yol/yeni/SecurityPoint-Portable`.

## Bilinen sınırlar

- Paket `x86_64` (amd64) içindir; ARM64 için CI'da ayrı derleme gerekir.
- Masaüstü kısayolu `xdg-open` kullanır; masaüstü ortamı yoksa (saf sunucu) tarayıcı açılmaz,
  adresi elle açın (`P26_NO_BROWSER=1` ile tarayıcı açmayı kapatabilirsiniz).
- PostgreSQL 16 çalıştırıcıları CI ortamındaki dağıtımdan alınır; glibc uyumu için
  Ubuntu 22.04+ önerilir.
