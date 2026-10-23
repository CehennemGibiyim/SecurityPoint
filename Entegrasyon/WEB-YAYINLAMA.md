# Personel26 — Web'de Yayınlama

İki yol var; ihtiyaca göre biri ya da ikisi birlikte kullanılabilir.

| | A) GitHub Pages — **tam çalışan panel** | B) Vercel + Neon — ortak (çok kullanıcılı) sistem |
|---|---|---|
| Adres | `https://KULLANICI.github.io/REPO/` | `https://personel26-xxx.vercel.app` |
| Ne çalışır | **Panelin tamamı**: personel, puantaj, nöbet, izin, yazdırma, Excel/CSV, yedekleme | Aynısı |
| Veritabanı | **Tarayıcının içinde** (PostgreSQL/WASM + IndexedDB) | Neon PostgreSQL (sunucuda, ortak) |
| Veri paylaşımı | Yok — veriler yalnızca o tarayıcıda saklanır | Var — tüm kullanıcılar aynı veriyi görür |
| Ek ücret / hesap | Gerekmez (yalnızca GitHub) | Ücretsiz katman yeterli |
| İlk açılış | ~17 MB motor indirir (sonra önbellekten) | Hızlı |

> **Özet:** Paneli hızlıca görmek/denemek veya tek kişisel kullanım için **GitHub Pages**
> yeterlidir. Kurumda birden çok kişi aynı veriyi kullanacaksa **Vercel + Neon** kurun.

---

## A) GitHub Pages — panelin tamamı (tarayıcı içi veritabanı)

Panel, sunucu gerektirmeyecek şekilde derlenir: API katmanı tarayıcıya taşınır ve
gerçek PostgreSQL (PGlite/WASM) tarayıcıda çalışır; veriler tarayıcının IndexedDB
deposunda saklanır. Böylece giriş, kayıt, puantaj, nöbet, izin, yazdırma ve
Excel/CSV dışa aktarma dahil **her şey** `github.io` adresinde çalışır.

### 1. Tek seferlik ayar (ÖNEMLİ)

GitHub deposunda:

**Settings → Pages → Build and deployment → Source: `GitHub Actions`**

> Bu ayar yapılmazsa GitHub, deponun kök dizinini (README) yayınlar ve site
> boş/metin görünür: `https://KULLANICI.github.io/REPO/` adresinde README çıkar.
> "Deploy from a branch" seçeneği **seçili olmamalıdır.**

### 2. Yayınlama

`main` dalına yapılan her `git push` iş akışını (`.github/workflows/pages.yml`)
otomatik çalıştırır:

1. `npm ci` — bağımlılıklar
2. `node scripts/pages-build.mjs` — DDL + tarayıcı veritabanı paketi + Next.js statik çıktısı → `_site/`
3. `node scripts/pages-smoke-test.mjs` — tarayıcı içi veritabanı ve API uçları doğrulanır (42 kontrol)
4. `_site/` GitHub Pages'e yüklenir

Sonuç: `https://KULLANICI.github.io/REPO/`

İlk açılışta tarayıcıya PostgreSQL motoru (~17 MB) indirilir; bu sırada
"Tarayıcı veritabanı hazırlanıyor…" ekranı görünür. Sonraki açılışlar hızlıdır ve
verileriniz tarayıcıda kalıcıdır.

### 3. Yerelde deneme

```bash
npm run pages:build     # _site/ üretir (alt dizin: P26_BASE_PATH ile ayarlanır)
npm run pages:serve     # http://127.0.0.1:4173/REPO/ adresinde sunar
npm run pages:test      # tarayıcısız duman testi (veritabanı + tüm API uçları)
```

Alt dizin olmadan (kök alan adı / özel alan adı) denemek için:

```bash
P26_BASE_PATH= npm run pages:build && npm run pages:serve
```

### 4. Veriler hakkında

- Veriler **yalnızca kullandığınız tarayıcıda** tutulur; başka bir cihaz/tarayıcı
  kendi boş veritabanıyla başlar (örnek verilerle).
- Paneli temizlemek için sağ alttaki **"Sıfırla"** düğmesini kullanın
  (örnek veriler yeniden kurulur).
- Şema değiştiğinde (yeni sürüm) tarayıcı veritabanı otomatik yenilenir.
- Kişisel veriler (TC kimlik vb.) tarayıcıdan dışarı çıkmaz.

---

## B) Vercel + Neon — ortak, canlı sistem

### 1. Ücretsiz veritabanı (Neon)
1. https://neon.tech → GitHub ile giriş → **New Project** (bölge: Frankfurt önerilir)
2. **Connection string**'i kopyalayın. Örnek:
   `postgresql://kullanici:sifre@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 2. Tabloları oluşturun (bir kez, kendi bilgisayarınızda)
```bash
# proje klasöründe
echo DATABASE_URL="YUKARIDAKI_BAGLANTI" > .env
npm install
npx drizzle-kit push
```

### 3. Vercel'e bağlayın
1. https://vercel.com → GitHub ile giriş → **Add New → Project**
2. Personel26 deposunu seçin → **Import**
3. **Environment Variables** bölümüne ekleyin:
   - `DATABASE_URL` = Neon bağlantı adresiniz
4. **Deploy**

Birkaç dakika içinde `https://personel26-xxx.vercel.app` adresinde sistem açılır.
İlk açılışta örnek veriler otomatik yüklenir (istemezseniz Personel Yönetimi'nden silebilirsiniz).

> **Not:** `DATABASE_URL` derleme aşamasında zorunlu değildir; bu yüzden CI derlemeleri
> bağlantı adresi yokken çökmez. Ancak **canlı sitede** mutlaka Vercel → Settings →
> Environment Variables bölümüne ekleyin. Ayar yoksa API katmanı anlaşılır bir
> veritabanı yapılandırma hatası döner.

### 4. Güncelleme
Kodda değişiklik yapıp `git push` dediğinizde Vercel siteyi otomatik yeniden derler.

---

## Güvenlik Uyarısı (canlı yayın için önemli)

Sistem şu an **giriş ekranı olmadan** çalışır: adresi bilen herkes yönetim paneline erişebilir.
İnternete açık yayın yapacaksanız:

- Vercel → Project → **Settings → Deployment Protection** ile şifre koruması açın, **veya**
- Yalnızca kurum içi ağda / Windows paketiyle kullanın, **veya**
- Bir sonraki geliştirme adımı olarak kullanıcı girişi (yönetici şifresi) ekletin.

Personel verileri (TC Kimlik No dahil) kişisel veridir; KVKK gereği erişimi sınırlandırın.
GitHub Pages sürümünde veriler tarayıcıda kaldığı için sunucuya hiçbir kayıt gönderilmez.

---

## Windows'ta yerel kullanım
İnternete açmadan tek bilgisayarda/kurum ağında kullanmak için:
**[WINDOWS-KURULUM.md](WINDOWS-KURULUM.md)**
