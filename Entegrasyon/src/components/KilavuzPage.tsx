"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  BookOpenText,
  CircleHelp,
  DoorOpen,
  FileSpreadsheet,
  Keyboard,
  Lightbulb,
  ScanFace,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui";

type Item = {
  title: string;
  what: string;
  /** "Ne eklersen ne olur" — işlemin karşılığı. */
  effect?: string;
  steps?: string[];
};

type Section = {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  grad: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    id: "baslarken",
    title: "Başlarken",
    desc: "Sistem iki parçalı: kapı geçiş (biyometri) ve resmi puantaj. Her ikisi tek veritabanında çalışır.",
    icon: <Sparkles className="h-4 w-4" />,
    grad: "from-sky-500 to-violet-600",
    items: [
      {
        title: "Erişim yolları",
        what: "• Canlı panel (ücretsiz barındırma): cehennemgibiyim.github.io/SecurityPoint — tarayıcıda çalışır, veriler o tarayıcıda saklanır.\n• Windows kurulumu: Personel26 Kurulum (.exe) ile bilgisayara kurulur; kendi PostgreSQL sunucusuyla gelir, dosyalar yerelde kalır.",
      },
      {
        title: "Yönetici girişi",
        what: "Panel ve kapı terminali açılışında kullanıcı adı ve PIN ister. Oturum imzalıdır ve 30 gün açık kalır; sağ üstteki çıkış düğmesiyle kapatılır.",
        steps: ["Giriş ekranında kullanıcı adı ve PIN'i girin", "Oturum kapanınca tekrar sorulur", "PIN paket içinde düz metin durmaz (SHA-256 özeti saklanır)"],
      },
      {
        title: "İlk kurulum sırası (önerilen)",
        what: "Verinin doğru akması için sırayı izleyin:",
        steps: [
          "Servisleri tanımlayın (üst menü → Servisler / Departman → Yeni servis)",
          "Personeli ekleyin: Personel & Biyometri veya Ayarlar → Veri Aktarımı (Excel)",
          "Vardiyaları ve vardiya şablonlarını tanımlayın",
          "Kapıları ekleyin, Kapı Yetkileri ile personeli kapılara bağlayın",
          "Yedekleme merkezinden ilk yedeği alın",
        ],
      },
      {
        title: "Ücret var mı?",
        what: "Hayır. Tüm modüller (biyometri, puantaj, bordro, PDF çıktıları, QR ziyaretçi, e-posta) ücretsizdir; tek gider kendi e-posta hesabınızın SMTP bilgileridir.",
      },
    ],
  },
  {
    id: "face",
    title: "Kapı Geçiş Sistemi",
    desc: "Yüz tanımalı giriş-çıkış, kapı yetkileri, imza ve saha güvenliği menüleri.",
    icon: <ScanFace className="h-4 w-4" />,
    grad: "from-cyan-400 to-sky-600",
    items: [
      {
        title: "Canlı Panel (Tesis nabzı)",
        what: "Kadro, içeridekiler, açık molalar, gelmeyenler ve reddedilen denemeler tek ekranda. Anlık geçişler ve kapı durumları 4 saniyede bir yenilenir.",
        effect: "Personel veya kapı eklediğinizde sayaçlar ve listeler kendiliğinden güncellenir.",
      },
      {
        title: "Yüz Terminali (Kapı ekranı)",
        what: "Kapıdaki ekrandır: yüzü okur, giriş/çıkış/mola imzası atlar, yetkiyi kontrol eder. Aynı anda birkaç kapı açılabilir.",
        effect: "Personel + yüz kaydı + vardiya + kapı yetkisi tamamsa geçiş ONAYLANIR; biri eksikse reddedilir ve gerekçesi yazar.",
        steps: ["Tam ekran için: /terminal?kiosk=1", "Windows'ta: Personel26 Kiosk kısayolu (Edge kiosk modunda açar)", "ESC ile kiosk'tan çıkılır"],
      },
      {
        title: "Personel & Biyometri",
        what: "Personel kartları: sicil, birim, vardiya ve yüksek yoğunluklu yüz şablonu. Yüz fotoğrafı yüklenir, kalibrasyon ve canlılık ayarları yapılır.",
        effect: "Burada oluşturulan her kart OTOMATİK olarak resmi Puantaj26 sistemine de aktarılır — iki modülde de görünür.",
      },
      {
        title: "Kapılar",
        what: "Turnike, üretim holü, sunucu odası gibi kapı noktaları. Her kapının tipi (giriş/çift yön), politikası (yetki gerekli / herkes) ve kilit durumu vardır.",
        effect: "Yeni kapı ekleyince Yüz Terminali ve Kapı Yetkileri listelerinde anında görünür; ‘Kilitli’ yapınca yetki aranmaz.",
      },
      {
        title: "Kapı Yetkileri",
        what: "Erişim matrisi: hangi personel, hangi kapıdan, hangi gün ve saat aralığında geçebilir. Güvenlik amiri tüm kapılara 7/24 yetkilidir.",
        effect: "Yetki verdiğiniz personel kapıda kabul edilir; yetkiyi kaldırınca bir sonraki denemede REDDEDİLİR.",
      },
      {
        title: "İmza Defteri",
        what: "Kim kaçta geldi, kaçta çıktı; geç kalma ve istirahat dakikaları aynı satırda. Operatör klavyeden de Giriş/Çıkış/Mola imzası atabilir.",
        effect: "Yüz terminalinden yapılan her geçiş buraya düşer; manuel imza da aynı kaydı üretir.",
      },
      {
        title: "Kapı İmza",
        what: "Yüz/kart doğrulama OLAY kayıtları (tarih bazlı, ilk 200 olay). Yalnızca okuma ekranıdır.",
        effect: "Kayıt olmaması devamsızlık anlamına gelmez; bu kayıtlar hukuki e-imza değildir.",
      },
      {
        title: "İstirahat",
        what: "Yemek, çay, namaz ve kısa molalar. Açık molalar canlı sayılır, 5 saniyede bir yenilenir.",
        effect: "Terminalden mola başlatınca burada ‘Devam ediyor’ görünür; ‘Molayı bitir’ ile kapatılır, süre puantaja işlenir.",
      },
      {
        title: "Vardiyalar",
        what: "Mesai planı: başlangıç-bitiş, mola hakkı ve geç kalma toleransı. Renk koduyla listelenir.",
        effect: "Yeni vardiya tanımlayınca Yüz Terminali giriş saatini BUNA GÖRE değerlendirir; tolerans aşılırsa ‘geç’ işaretlenir.",
      },
      {
        title: "İzin & Devamsızlık",
        what: "Yıllık/mazeret/rapor izinleri, onay akışı ve yıllık bakiye takibi.",
        effect: "Talep oluşturup ONAYLADIĞINIZ izin günü terminalde mesai başlatmayı ENGELLER; Puantaj’dan da düşer. SMTP açıksa onay/red e-postası gider.",
      },
      {
        title: "Ziyaretçiler",
        what: "Ön kayıt + süreli TEK GEÇİŞLİK QR e-pass, ev sahibi atama, giriş/çıkış düğmeleri ve yazdırılabilir yaka kartı.",
        effect: "Ziyaretçi oluşturunca QR üretilir; ilk geçişte QR geçersizleşir. Yasaklı (blacklist) liste Güvenlik Merkezi’nden yönetilir.",
      },
      {
        title: "Güvenlik Merkezi",
        what: "Anti-passback (çıkış yapmadan tekrar giriş engeli), zone doluluk, blacklist, hayalet tespiti, acil durum kilit açma, reddedilen deneme galerisi ve alarm kapatma.",
        effect: "Anti-passback açınca çıkışsız tekrar giriş ALARM üretir; ‘Kapıları Acil Aç’ ile süre boyunca yetki aranmaz, işlem imza defterine sorumlu adıyla yazılır.",
      },
      {
        title: "Acil Durum Yoklaması",
        what: "Yangın/tahliye anında içeridekileri sayma (roll-call).",
        effect: "Bu menü Güvenlik Merkezi’ne yönlendirir; ‘Yoklamayı Başlat’ ile içeridekiler listelenir, güvenli işaretlenmeyenler eksik sayılır.",
      },
      {
        title: "PDKS Bordro Özeti",
        what: "Aylık puantajdan bordro hakedişine: fazla mesai %50, resmi tatil çalışması ayrıca hesaplanır.",
        effect: "Dönem seçin → ‘Toplu Onayla’ → satır satır kilitle → CSV indir (Logo/Paraşüt/Mikro formatına uygun).",
      },
      {
        title: "Raporlar",
        what: "Seçilen tarih aralığında çalışma süresi, istirahat, geç kalma ve devamsızlık raporu.",
        effect: "Tarihleri seçin, ‘CSV indir’ ile bordro öncesi dökümü alın.",
      },
      {
        title: "Sistem & KVKK",
        what: "KVKK için alternatif kimlikler, yemekhane ve offline dayanıklılık ayarları, sistem kontrol listesi.",
        effect: "KVKK maskeleme açıldığında TC kimlikler listede yalnız son 4 haneyle görünür.",
      },
    ],
  },
  {
    id: "p26",
    title: "Personel26 (Puantaj) Menüleri",
    desc: "Resmi nöbet, puantaj, bordro ve onay modülleri — sol menüde ‘Personel26’ grubu.",
    icon: <FileSpreadsheet className="h-4 w-4" />,
    grad: "from-amber-400 to-orange-600",
    items: [
      {
        title: "Nöbet Çizelgesi",
        what: "Dönem için vardiya atamaları. İzinli personel otomatik olarak listenin dışına çıkar; dinlenme süreleri ve mükerrer vardiya koruması aktiftir.",
        effect: "Şablon ve personel ekleyince ‘Otomatik dağıt’ dengeli dağıtır; çıktıyı Yazdır / PDF ile verin.",
      },
      {
        title: "Puantaj Cetveli",
        what: "Aylık çalışma cetveli: gün gün gelme, çalışma, mola ve eksik günler.",
        effect: "Dönem/geçen seçin → ‘Yazdır / PDF’ ile resmi çıktıyı alın (imza alanlı önizleme açılır).",
      },
      {
        title: "Maaş Bordro (Resmi)",
        what: "Puantaj üzerinden otomatik ücret hesabı.",
        effect: "Ücret ve günler aktıkça bordro satırları kendiliğinden hesaplanır.",
      },
      {
        title: "Vardiya Şablonları",
        what: "2’li / 3’lü düzenler ve özel şablon tanımları.",
        effect: "Şablon eklediğinizde Nöbet Çizelgesi yeni şablonu dağıtıma sokar.",
      },
      {
        title: "Servis & Kadro Yönetimi",
        what: "Personel ekleme, düzenleme, servis (departman) atama, grup seçimi (Sağlık / Destek / Teknisyen / özel grup).",
        effect: "Personel ekleyince nöbet, puantaj, bordro ve analiz sayfalarında anında görünür; kapı tarafındaki kart da güncellenir.",
      },
      {
        title: "TC Personel Sorgu",
        what: "Şifresiz, sadece TC ile personel sorgu ekranı (kalabalık alanlar için /personel-sorgu).",
        effect: "Kapı görevlisi TC’yi yazar; izinli mi, hangi nöbeti var bilgisi okunur.",
      },
      {
        title: "Resmi İzin Onayları",
        what: "İzin taleplerinin onay/red akışı ve bakiye görünümü.",
        effect: "Onaylayınca ilgili gün puantaj ve nöbetten düşer; SMTP açıksa karar e-postası gider.",
      },
      {
        title: "Nöbet Değişimi (Takas)",
        what: "Personelin birbirleriyle nöbet takas talepleri.",
        effect: "Talep onaylanınca çizelgede karşılıklı yer değiştirir, analiz yeniden hesaplanır.",
      },
      {
        title: "Adalet Analizi",
        what: "Nöbet dağılımının personele göre adalet dökümü (kim kaç nöbet tutmuş).",
        effect: "Dağıtım yaptıkça yüzdeler güncellenir; dengesizliği görüp elle müdahale edin.",
      },
      {
        title: "Mevzuat Uyarıları",
        what: "Dinlenme süresi ihlali, haftalık/aylık limit aşımı gibi uyarılar.",
        effect: "Sıkışık program kurulduğunda ilgili personel için uyarı üretilir.",
      },
      {
        title: "Servis Duyuruları",
        what: "Servislere yönelik duyuru ve bildirimler.",
        effect: "Duyuru ekleyince ilgili sayfalarda görüntülenir.",
      },
      {
        title: "Veri Yedekleme",
        what: "JSON ve SQL yedekleri, geri yükleme önizlemesi ve şema çıktısı.",
        effect: "‘Günlük otomatik yedek’ açıksa Windows sürümünde her gün 19:00’da data/backups içine SQL yedek düşer; geri yüklemede EKSİK veriyle onay reddedilir.",
      },
      {
        title: "Kurum & Sistem Ayarları",
        what: "Kurum bilgisi/logo, 20+ tema, Excel’den personel aktarımı, SMTP e-posta, yedekleme, sistem bilgileri.",
        effect: "Ayarları ‘Değişiklikleri kaydet’ ile uygulayın; tema tüm panellerde, SMTP yalnız sunuculu (Windows) sürümünde gönderir.",
      },
    ],
  },
  {
    id: "tarifler",
    title: "Adım Adım Tarifler",
    desc: "En çok yapılan işlemlerin kısa yolu.",
    icon: <Lightbulb className="h-4 w-4" />,
    grad: "from-amber-500 to-yellow-500",
    items: [
      {
        title: "Yeni personel + yüz kaydı",
        what: "Personel & Biyometri → yeni kart → sicil/birim/vardiya bilgileri → yüz fotoğrafı yükle. Kayıt otomatik olarak Puantaj26’ya da aktarılır.",
      },
      {
        title: "Kapı açma & yetkilendirme",
        what: "1) Kapılar → ‘Yeni kapı’ (ad, kod, tip, politika). 2) Kapı Yetkileri → personeli kapı + gün/saat aralığıyla eşleştir. 3) Yüz Terminali’nde deneyin.",
      },
      {
        title: "İzin onayı + e-posta bildirimi",
        what: "İzin & Devamsızlık → talebi onayla/reddet. E-posta için: Ayarlar → Bildirimler → SMTP bölümünü doldurun, ‘SMTP bağlantısını dene’ ile kontrol edip kaydedin (ücretsiz, kendi hesabınız).",
      },
      {
        title: "Puantaj / Nöbet PDF çıktısı",
        what: "Puantaj Cetveli veya Nöbet Çizelgesi → dönem seç → ‘Yazdır / PDF’ → önizlemede tarayıcının yazdır → PDF olarak kaydet.",
      },
      {
        title: "Excel’den toplu personel aktarımı",
        what: "Ayarlar → Veri Aktarımı → CSV/Excel dosyasını seç → sütun eşlemesini kontrol et → önizlemedeki hataları düzelt → onayla. Hatalı satırlar tek işlemde engellenir.",
      },
      {
        title: "Yedek al & geri yükle",
        what: "Veri Yedekleme → JSON/SQL yedek indir. Geri yüklemede önce önizleme yapılır, onay için ‘GERİ YÜKLE’ yazmanız istenir; başarısız işlem tamamen geri alınır.",
      },
    ],
  },
  {
    id: "sistem",
    title: "Sistem, Güvenlik ve Ücretsiz Servisler",
    desc: "Kurulum tercihleri ve dikkat edilecekler.",
    icon: <ShieldCheck className="h-4 w-4" />,
    grad: "from-emerald-500 to-teal-600",
    items: [
      {
        title: "Otomatik açılış ve otomatik yedek (Windows)",
        what: "Kurulum sihirbazında iki seçenek: ‘Windows açılışında otomatik başlat’ ve ‘Her gün 19:00 otomatik SQL yedek’. Kaldırmak için: Personel26-Yonet.ps1 -Action AutoStart Off / AutoBackup Off.",
      },
      {
        title: "Kiosk modu (kapı ekranı)",
        what: "Personel26 Kiosk kısayolu Edge kiosk (adres çubuksuz) modunda kapı terminalini açar; çıkış için ESC. Adresle: /terminal?kiosk=1.",
      },
      {
        title: "E-posta (ücretsiz)",
        what: "Gmail/Outlook SMTP + uygulama şifresi yeterlidir. Kapalıyken hiçbir e-posta gönderilmez; gönderim yalnız sunuculu (Windows) sürümünde çalışır — GitHub Pages’de sunucu yoktur.",
      },
      {
        title: "Veriler nerede?",
        what: "Windows sürümünde: yerel PostgreSQL (data/ klasörü + otomatik yedekler). Canlı panelde: kullanıcının tarayıcısı (IndexedDB). Yedek almadan tarayıcı verisi temizlenirse kaybolur.",
      },
      {
        title: "KVKK",
        what: "Ayarlar → ‘TC kimlik numaralarını maskele’ ile listelerde yalnız son 4 hane görünür; yetkisiz personel kartı açamaz.",
      },
    ],
  },
  {
    id: "sss",
    title: "Sıkça Sorulanlar",
    desc: "Kısa cevaplar.",
    icon: <CircleHelp className="h-4 w-4" />,
    grad: "from-violet-500 to-purple-600",
    items: [
      {
        title: "Canlı panel ile Windows sürümü farkı ne?",
        what: "İçerik birebir aynıdır. Canlı panelde veri tarayıcıda saklanır (paylaşımlı bilgisayarda dikkat); Windows sürümünde veri yerel PostgreSQL’dedir, e-posta ve otomatik yedek çalışır.",
      },
      {
        title: "Sistem ücretli mi?",
        what: "Hayır — hiçbir modül ücret istemez. Tek gereksinim kendi e-posta hesabınızın (ücretsiz) uygulama şifresidir.",
      },
      {
        title: "Kapıda ‘Reddedildi’ yazıyor, ne yapayım?",
        what: "Sırayla kontrol: personel aktif mi → yüz kaydı var mı → vardiya tanımlı mı → Kapı Yetkileri’nde bu kapı için yetkisi var mı → kapı kilitli mi. Gerekçe satırı hangi adımda düştüğünü yazar.",
      },
      {
        title: "PDF çıktısı nasıl alınır?",
        what: "Puantaj Cetveli ve Nöbet Çizelgesi’ndeki ‘Yazdır / PDF’ düğmesi önizleme açar; tarayıcıdan ‘PDF olarak kaydet’ seçin. Raporlar ekranında CSV indirilebilir.",
      },
      {
        title: "Yedekleri kim saklıyor?",
        what: "Ücretsiz: günlük otomatik SQL yedeği yerel data/backups klasörüne (Windows) ve manuel JSON/SQL indirme. Harici depoya kopyalama sizin ek bir adımlarınızdır.",
      },
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/20 ${section.grad}`}
        >
          {section.icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{section.title}</h2>
          <p className="text-sm text-slate-400">{section.desc}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {section.items.map((item) => (
          <article key={item.title} className="orion-card rounded-3xl p-5">
            <h3 className="font-semibold text-white">{item.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">{item.what}</p>
            {item.steps ? (
              <ol className="mt-3 space-y-1.5">
                {item.steps.map((step, index) => (
                  <li key={step} className="flex gap-2 text-sm text-slate-300">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] font-bold text-cyan-200">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            {item.effect ? (
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-[13px] leading-5 text-amber-100/90">
                <b className="text-amber-200">Ne eklersen ne olur: </b>
                {item.effect}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function KilavuzPage() {
  const navRef = useRef<HTMLDivElement | null>(null);

  function goTo(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <PageHeader
        kicker="Yardım"
        title="Kullanım Kılavuzu"
        description="Her menü ne işe yarar, bir şey eklediğinizde ne olur — adım adım tarifler ve sık sorulanlar. Bu sayfa sistemle birlikte gelir, internetsiz de açılır."
        actions={
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Canlı Panele dön <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {/* Bölümlere hızlı geçiş */}
      <div
        ref={navRef}
        className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-3"
      >
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => goTo(section.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.05] px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
          >
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br text-white ${section.grad}`}>
              {section.icon}
            </span>
            {section.title}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        {SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <div className="orion-card rounded-3xl p-5">
          <DoorOpen className="h-5 w-5 text-cyan-300" />
          <h3 className="mt-3 font-semibold text-white">Kapı tarafı hızlı yardım</h3>
          <p className="mt-1 text-sm text-slate-400">
            Geçiş reddediyorsa gerekçe satırına bakın: yetki, yüz, vardiya veya kilit kontrolü orada yazar.
          </p>
        </div>
        <div className="orion-card rounded-3xl p-5">
          <Settings2 className="h-5 w-5 text-amber-300" />
          <h3 className="mt-3 font-semibold text-white">Ayarlar kısa yolu</h3>
          <p className="mt-1 text-sm text-slate-400">
            Ayarlar → <b>Sistem</b> sekmesinde uygulama, veritabanı ve şema bilgisi;{" "}
            <b>Bildirimler</b> sekmesinde ücretsiz SMTP e-posta ayarı bulunur.
          </p>
        </div>
        <div className="orion-card rounded-3xl p-5">
          <Keyboard className="h-5 w-5 text-violet-300" />
          <h3 className="mt-3 font-semibold text-white">Kısayollar</h3>
          <p className="mt-1 text-sm text-slate-400">
            Ayarlar içinde <b>Ctrl/⌘ + K</b> arama, <b>ESC</b> kapatır. Kiosk terminalinde <b>ESC</b> tam ekrandan çıkar.
          </p>
        </div>
      </div>
    </div>
  );
}