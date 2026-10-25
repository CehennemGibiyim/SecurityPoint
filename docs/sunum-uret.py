#!/usr/bin/env python3
"""
SecurityPoint — ORION FaceGate × Puantaj26 tanıtım sunumu (PDF) üreticisi.

Kullanım (repo kökünden):
    python3 docs/sunum-uret.py            → docs/SecurityPoint-Sunum.pdf

Gereksinimler:  pip install fpdf2 pillow
Yazı tipleri:   DejaVuSans (Türkçe destekli) — birkaç olası konumda aranır,
                isterseniz P26_FONT_DIR ile klasör gösterebilirsiniz.
Görseller:      Entegrasyon/public/scenes/*.jpg fotoğrafları kullanılır;
                panel/terminal "ekran görüntüleri" Pillow ile temsilî olarak çizilir.
"""

import os
import shutil
import tempfile

from fpdf import FPDF
from fpdf.enums import MethodReturnValue, XPos, YPos
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

# ---------------------------------------------------------------- konumlar
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SCENES = os.path.join(ROOT, "Entegrasyon", "public", "scenes")
BRAND = os.path.join(ROOT, "Entegrasyon", "public", "brand", "orion-face-aurora.png")
OUT_PDF = os.path.join(HERE, "SecurityPoint-Sunum.pdf")

FONT_DIRS = [
    os.environ.get("P26_FONT_DIR", ""),
    os.path.join(ROOT, ".yer", "fontlar", "extracted", "usr", "share", "fonts", "truetype", "dejavu"),
    "/usr/share/fonts/truetype/dejavu",
]


def find_font(name: str) -> str:
    for d in FONT_DIRS:
        if d and os.path.isfile(os.path.join(d, name)):
            return os.path.join(d, name)
    raise SystemExit(
        f"Yazı tipi bulunamadı: {name}\n"
        "DejaVuSans indirin veya P26_FONT_DIR ile klasör gösterin."
    )


REG = find_font("DejaVuSans.ttf")
BOLD = find_font("DejaVuSans-Bold.ttf")

# ---------------------------------------------------------------- palet
BG = (7, 11, 20)
PANEL = (13, 20, 36)
PANEL2 = (17, 26, 46)
BORDER = (34, 47, 76)
WHITE = (244, 247, 252)
SLATE = (148, 163, 184)
SLATE_D = (100, 116, 139)
CYAN = (56, 189, 248)
AMBER = (252, 211, 77)
GREEN = (52, 211, 153)
ROSE = (251, 113, 133)
VIOLET = (167, 139, 250)

W, H = 297.0, 210.0  # A4 yatay (mm)
ML, MR, MT = 14.0, 14.0, 14.0

PT_MM = 0.352778


def lh_of(size: float, leading: float = 1.35) -> float:
    return size * leading * PT_MM


class Sunum(FPDF):
    def __init__(self):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.set_auto_page_break(False)
        self.set_margins(ML, MT, MR)
        self.add_font("djv", "", REG)
        self.add_font("djv", "B", BOLD)
        self.tmp = tempfile.mkdtemp(prefix="p26-sunum-")

    # ---------------------------------------------------- yardımcılar
    def para(
        self,
        x,
        y,
        w,
        txt,
        size=9.0,
        color=SLATE,
        bold=False,
        leading=1.35,
        max_lines=None,
    ):
        """Sarmalanmış metni çizer, altına geçtiği yüksekliği döndürür."""
        self.set_font("djv", "B" if bold else "", size)
        lh = lh_of(size, leading)
        lines = self.multi_cell(
            w, lh, txt, dry_run=True, output=MethodReturnValue.LINES
        )
        if max_lines is not None and len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = (lines[-1][:-1] if len(lines[-1]) > 1 else lines[-1]) + "…"
        body = "\n".join(lines)
        self.set_text_color(*color)
        self.set_xy(x, y)
        self.multi_cell(w, lh, body, new_x=XPos.LEFT, new_y=YPos.NEXT)
        return len(lines) * lh

    def one(self, x, y, w, txt, size=9, color=WHITE, bold=False, align="L"):
        self.set_font("djv", "B" if bold else "", size)
        self.set_text_color(*color)
        self.set_xy(x, y)
        self.cell(
            w,
            size * 1.35 * PT_MM,
            txt,
            align=align,
            new_x=XPos.LEFT,
            new_y=YPos.NEXT,
        )

    def card(self, x, y, w, h, fill=PANEL, border=BORDER, r=3.0):
        self.set_fill_color(*fill)
        self.set_draw_color(*border)
        self.set_line_width(0.25)
        self.rect(x, y, w, h, style="DF", round_corners=True, corner_radius=r)

    def chip(self, x, y, w, h, label, fg, bg, size=7.5):
        self.set_fill_color(*bg)
        self.rect(x, y, w, h, style="F", round_corners=True, corner_radius=h / 2)
        self.one(x, y + (h - size * 1.35 * PT_MM) / 2 - 0.2, w, label, size=size, color=fg, bold=True, align="C")

    def bullet(self, x, y, w, txt, size=8.6, color=SLATE, dot=CYAN):
        self.set_fill_color(*dot)
        r = 0.75
        self.rect(x + r, y + lh_of(size) / 2 - r, r * 2, r * 2, style="F", round_corners=True, corner_radius=r)
        h = self.para(x + 5, y, w - 5, txt, size=size, color=color, leading=1.4)
        return max(h, lh_of(size, 1.4))

    # ---------------------------------------------------- sayfa iskeleti
    def background(self):
        self.set_fill_color(*BG)
        self.rect(0, 0, W, H, style="F")

    def head(self, kicker, title, subtitle=None, accent=CYAN, page_no=None, total=None):
        self.add_page()
        self.background()
        self.set_fill_color(*accent)
        self.rect(0, 0, W, 2.4, style="F")
        self.one(ML, 9.5, 140, kicker.upper(), size=8, color=accent, bold=True)
        self.one(ML, 14.0, 220, title, size=21, color=WHITE, bold=True)
        y = 23.5
        if subtitle:
            y = self.para(ML, y, W - ML - MR, subtitle, size=9.5, color=SLATE, leading=1.35, max_lines=2) + y
        self.set_draw_color(*BORDER)
        self.set_line_width(0.25)
        self.line(ML, max(y + 3, 32), W - MR, max(y + 3, 32))
        self.one(W - MR - 120, 9.5, 120, "SECURITYPOINT · TANITIM SUNUMU", size=7.5, color=SLATE_D, bold=True, align="R")
        if page_no:
            self.sayfa_no(page_no, total)
        return max(y + 8, 38)

    def sayfa_no(self, n, total):
        self.one(ML, H - 9.5, 170, "SecurityPoint — ORION FaceGate × Puantaj26 · Ücretsiz & açık kaynak", size=7.5, color=SLATE_D)
        self.one(W - MR - 60, H - 9.5, 60, f"{n} / {total}", size=7.5, color=SLATE_D, bold=True, align="R")


# ================================================================ görseller
def photo(path, out_name, size_px, tmp, ramp="all", strength=0.95, dark=0.6):
    """Fotoğrafı hedef orana kırpıp karanlık degrade yerleştirir."""
    if not os.path.isfile(path):
        img = Image.new("RGB", size_px, (10, 16, 30))
        img.save(os.path.join(tmp, out_name), quality=88)
        return os.path.join(tmp, out_name)
    im = Image.open(path).convert("RGB")
    im = ImageOps.fit(im, size_px, Image.LANCZOS)
    im = ImageEnhance.Brightness(im).enhance(dark)
    im = ImageEnhance.Color(im).enhance(0.85)
    w, h = im.size
    overlay = Image.new("RGB", (w, h), (4, 7, 14))
    mask = Image.new("L", (w, 1))
    if ramp == "left":  # solda koyu → sağda açık
        data = [int(255 * strength * (1 - x / max(w - 1, 1)) ** 1.15) for x in range(w)]
    elif ramp == "bottom":
        mask = Image.new("L", (1, h))
        data = [int(255 * strength * (y / max(h - 1, 1)) ** 1.4) for y in range(h)]
    else:  # all
        data = [int(255 * strength)] * w
    mask.putdata(data)
    mask = mask.resize((w, h))
    im = Image.composite(overlay, im, mask)
    p = os.path.join(tmp, out_name)
    im.save(p, quality=86)
    return p


# ---------------------------------------------------- temsilî panel çizimi
MENU = [
    ("Canlı Panel", (34, 211, 238), True),
    ("Yüz Terminali", (56, 189, 248), False),
    ("Personel & Biyometri", (96, 165, 250), False),
    ("Kapılar", (251, 146, 60), False),
    ("Kapı Yetkileri", (52, 211, 153), False),
    ("İmza Defteri", (167, 139, 250), False),
    ("İzin & Devamsızlık", (251, 113, 133), False),
    ("Güvenlik Merkezi", (244, 63, 94), False),
]


def draw_panel_mock(tmp):
    """Panel ekranının temsilî çizimi (gerçek ekran görüntüsü yerine)."""
    w, h = 1800, 1120
    img = Image.new("RGB", (w, h), (7, 11, 20))
    d = ImageDraw.Draw(img)
    f = lambda s: ImageFont_truetype(REG, s)
    fb = lambda s: ImageFont_truetype(BOLD, s)

    # kenar çubuğu
    d.rectangle([0, 0, 448, h], fill=(9, 14, 27))
    d.line([448, 0, 448, h], fill=(34, 47, 76), width=2)
    d.rounded_rectangle([30, 30, 100, 100], radius=20, fill=(56, 189, 248))
    d.ellipse([48, 48, 82, 82], outline=(255, 255, 255), width=5)
    d.text((116, 34), "ORION", font=fb(36), fill=(244, 247, 252))
    d.text((116, 76), "FaceGate × Puantaj26", font=f(20), fill=(120, 140, 170))

    y = 150
    d.text((30, y), "KAPI GEÇİŞ SİSTEMİ", font=fb(17), fill=(80, 190, 220))
    y += 44
    for label, color, active in MENU:
        if active:
            d.rounded_rectangle([14, y - 8, 434, y + 54], radius=14, fill=(16, 47, 68))
            d.rounded_rectangle([14, y - 8, 22, y + 54], radius=6, fill=(34, 211, 238))
        d.rounded_rectangle([34, y, 78, y + 44], radius=12, fill=color)
        d.text((94, y + 9), label, font=fb(23), fill=(244, 247, 252) if active else (150, 165, 190))
        y += 74
    y += 14
    d.text((30, y), "PERSONEL26", font=fb(17), fill=(230, 190, 110))
    y += 44
    for label, color in [("Puantaj Cetveli", (56, 189, 248)), ("Nöbet Çizelgesi", (167, 139, 250)), ("Veri Yedekleme", (99, 102, 241))]:
        d.rounded_rectangle([34, y, 78, y + 44], radius=12, fill=color)
        d.text((94, y + 9), label, font=fb(23), fill=(150, 165, 190))
        y += 74

    # üst çubuk
    x0 = 488
    d.text((x0, 46), "Tesis nabzı", font=fb(46), fill=(244, 247, 252))
    d.text((x0, 104), "Yüz okuma, giriş-çıkış imzası, istirahat ve kapı yetkileri tek ekranda", font=f(22), fill=(140, 156, 180))
    d.rounded_rectangle([1240, 46, 1560, 116], radius=18, fill=(252, 211, 77))
    d.text((1264, 64), "Puantaj26 Cetveli", font=fb(24), fill=(15, 20, 30))
    d.rounded_rectangle([1580, 46, 1770, 116], radius=18, fill=(56, 189, 248))
    d.text((1608, 64), "Terminal", font=fb(24), fill=(8, 15, 25))

    # sayaç kartları
    stats = [("KADRO", "128", (244, 247, 252)), ("İÇERİDE", "42", (52, 211, 153)), ("İSTİRAHAT", "6", (252, 211, 77)), ("REDDEDİLEN", "2", (251, 113, 133))]
    sx, sy, cw, ch, gap = x0, 170, 314, 176, 22
    for i, (label, val, col) in enumerate(stats):
        x = sx + i * (cw + gap)
        d.rounded_rectangle([x, sy, x + cw, sy + ch], radius=22, fill=(13, 20, 36), outline=(34, 47, 76), width=2)
        d.text((x + 24, sy + 22), label, font=fb(18), fill=(130, 146, 172))
        d.text((x + 24, sy + 62), val, font=fb(76), fill=col)
        d.text((x + 24, sy + 144), "aktif kayıt", font=f(18), fill=(110, 126, 152))

    # sol alt: kim içeride
    px, py, pw, ph = x0, 386, 640, 560
    d.rounded_rectangle([px, py, px + pw, py + ph], radius=26, fill=(13, 20, 36), outline=(34, 47, 76), width=2)
    d.text((px + 28, py + 26), "Kim içeride?", font=fb(30), fill=(244, 247, 252))
    people = [("Ayşe Yılmaz", "Hemşire · 08:03", "İçeride", (52, 211, 153)), ("Mehmet Demir", "Teknisyen · 07:58", "İstirahat", (252, 211, 77)), ("Zeynep Kaya", "Memur · 08:11", "İçeride", (52, 211, 153)), ("Ali Çelik", "İşçi · —", "Gelmedi", (251, 113, 133))]
    ry = py + 90
    for name, sub, pill, col in people:
        d.rounded_rectangle([px + 24, ry, px + pw - 24, ry + 96], radius=18, fill=(20, 30, 52))
        d.ellipse([px + 40, ry + 18, px + 112, ry + 90], fill=(45, 70, 110))
        d.text((px + 132, ry + 20), name, font=fb(24), fill=(244, 247, 252))
        d.text((px + 132, ry + 56), sub, font=f(19), fill=(130, 146, 172))
        tw = d.textlength(pill, font=fb(19))
        d.rounded_rectangle([px + pw - 48 - tw - 28, ry + 30, px + pw - 48, ry + 70], radius=20, fill=(20, 45, 55) if col == (52, 211, 153) else ((60, 52, 20) if col == (252, 211, 77) else (60, 24, 32)))
        d.text((px + pw - 48 - tw - 14, ry + 39), pill, font=fb(19), fill=col)
        ry += 112

    # sağ alt: anlık geçişler
    qx, qw = px + pw + 26, 610
    d.rounded_rectangle([qx, py, qx + qw, py + ph], radius=26, fill=(13, 20, 36), outline=(34, 47, 76), width=2)
    d.text((qx + 28, py + 26), "Anlık geçişler", font=fb(30), fill=(244, 247, 252))
    events = [("Ayşe Yılmaz", "Ana kapı · 08:03", "ONAY"), ("Bilinmeyen", "Sunucu odası · 07:41", "RED"), ("Mehmet Demir", "Turnike · 07:58", "ONAY"), ("Zeynep Kaya", "Ana kapı · 08:11", "ONAY")]
    ry = py + 90
    for name, sub, res in events:
        d.ellipse([qx + 40, ry + 6, qx + 104, ry + 70], fill=(45, 70, 110))
        d.text((qx + 126, ry + 4), name, font=fb(23), fill=(244, 247, 252))
        d.text((qx + 126, ry + 40), sub, font=f(19), fill=(130, 146, 172))
        col = (52, 211, 153) if res == "ONAY" else (251, 113, 133)
        bgc = (20, 50, 40) if res == "ONAY" else (60, 24, 32)
        tw = d.textlength(res, font=fb(19))
        d.rounded_rectangle([qx + qw - 44 - tw - 30, ry + 14, qx + qw - 44, ry + 62], radius=18, fill=bgc)
        d.text((qx + qw - 44 - tw - 15, ry + 25), res, font=fb(19), fill=col)
        ry += 92

    # kapı şeridi
    d.rounded_rectangle([x0, 976, 1770, 1084], radius=22, fill=(13, 20, 36), outline=(34, 47, 76), width=2)
    d.text((x0 + 26, 1006), "Kapı noktaları", font=fb(24), fill=(244, 247, 252))
    doors = [("ANA-GIRIS", "Açık"), ("TURNIKE-01", "Kilitli"), ("SUNUCU-ODASI", "Kilitli")]
    dx = x0 + 300
    for code, state in doors:
        col = (52, 211, 153) if state == "Açık" else (251, 113, 133)
        d.text((dx, 1006), code, font=fb(22), fill=(150, 190, 220))
        d.text((dx, 1042), state, font=f(19), fill=col)
        dx += 440

    p = os.path.join(tmp, "panel-mock.png")
    img.save(p)
    return p


def draw_terminal_mock(tmp):
    """Kapıdaki yüz terminalinin temsilî çizimi."""
    w, h = 1400, 950
    img = Image.new("RGB", (w, h), (7, 11, 20))
    d = ImageDraw.Draw(img)
    f = lambda s: ImageFont_truetype(REG, s)
    fb = lambda s: ImageFont_truetype(BOLD, s)

    d.text((44, 34), "YÜZ TERMİNALİ", font=fb(40), fill=(244, 247, 252))
    d.text((470, 46), "KAPI-01 · ANA GİRİŞ", font=f(26), fill=(120, 160, 190))
    d.text((1130, 40), "08:03:41", font=fb(36), fill=(56, 189, 248))

    # kamera alanı
    d.rounded_rectangle([40, 120, 1360, 740], radius=28, fill=(12, 20, 36), outline=(34, 47, 76), width=3)
    # baş + omuz silueti
    cx, cy = 700, 430
    d.ellipse([cx - 128, cy - 168, cx + 128, cy + 168], fill=(58, 74, 104))
    d.rounded_rectangle([cx - 210, cy + 190, cx + 210, cy + 420], radius=120, fill=(58, 74, 104))
    d.ellipse([cx - 62, cy - 46, cx - 26, cy - 10], fill=(18, 26, 44))
    d.ellipse([cx + 26, cy - 46, cx + 62, cy - 10], fill=(18, 26, 44))
    d.arc([cx - 58, cy + 28, cx + 58, cy + 104], start=20, end=160, fill=(18, 26, 44), width=8)
    # tarama çerçevesi (köşe ayraçları — altın)
    fx0, fy0, fx1, fy1 = cx - 240, cy - 250, cx + 240, cy + 330
    L, t = 90, 9
    am = (232, 195, 106)
    for (X, Y, dx, dy) in [(fx0, fy0, 1, 1), (fx1, fy0, -1, 1), (fx0, fy1, 1, -1), (fx1, fy1, -1, -1)]:
        d.line([X, Y, X + dx * L, Y], fill=am, width=t)
        d.line([X, Y, X, Y + dy * L], fill=am, width=t)
    # tarama çizgisi
    for i, alpha_col in enumerate([(34, 120, 150), (56, 189, 248), (34, 120, 150)]):
        yy = cy - 60 + i * 6
        d.rectangle([fx0 + 24, yy, fx1 - 24, yy + 4], fill=alpha_col)
    # HUD halkaları
    d.arc([cx - 200, cy - 200, cx + 200, cy + 200], start=210, end=330, fill=(46, 233, 208), width=6)
    d.arc([cx - 236, cy - 236, cx + 236, cy + 236], start=30, end=120, fill=(56, 189, 248), width=5)

    # red kartı (kamera içinde, sağ üst)
    d.rounded_rectangle([1000, 156, 1330, 300], radius=20, fill=(58, 18, 30), outline=(251, 113, 133), width=3)
    d.text((1030, 178), "REDDEDİLDİ", font=fb(34), fill=(251, 113, 133))
    d.text((1030, 232), "Kapı yetkisi yok · sunucu odası", font=f(21), fill=(240, 170, 180))

    # sonuç kartı
    d.rounded_rectangle([40, 770, 1360, 910], radius=26, fill=(8, 44, 36), outline=(52, 211, 153), width=3)
    d.ellipse([76, 806, 156, 886], outline=(52, 211, 153), width=7)
    d.line([100, 848, 118, 866], fill=(52, 211, 153), width=9)
    d.line([118, 866, 148, 824], fill=(52, 211, 153), width=9)
    d.text((190, 796), "GEÇİŞ ONAYLANDI", font=fb(48), fill=(52, 211, 153))
    d.text((190, 858), "Ayşe Yılmaz · Hemşire · giriş 08:03 · mola hakkı 45 dk", font=f(26), fill=(170, 220, 205))
    d.text((1105, 826), "TURNIKE-01", font=fb(30), fill=(120, 200, 180))

    p = os.path.join(tmp, "terminal-mock.png")
    img.save(p)
    return p


from PIL import ImageFont


def ImageFont_truetype(path, size):
    return ImageFont.truetype(path, size)


# ================================================================ içerik
FACE_1 = [
    ("Canlı Panel", "Kadro, içeridekiler, açık molalar ve reddedilen denemeler tek ekranda; 4 sn’de bir yenilenir.", "Personel/kapı ekleyince sayaçlar anında güncellenir."),
    ("Yüz Terminali", "Kapıdaki ekran: yüzü okur, giriş/çıkış/mola imzası atlar, yetkiyi denetler.", "Yüz + vardiya + yetki tamamsa ONAY, eksikse RED + gerekçe."),
    ("Personel & Biyometri", "Sicil, birim, vardiya ve yüksek yoğunluklu yüz şablonu kaydı.", "Her kart otomatik olarak Puantaj26’ya da aktarılır."),
    ("Kapılar", "Turnike, hol, sunucu odası... kapı noktaları; tip, politika ve kilit durumu.", "Kapı ekleyince terminal ve yetki listelerinde anında görünür."),
    ("Kapı Yetkileri", "Kim, hangi kapıdan, hangi gün/saatte geçebilir — erişim matrisi.", "Yetki verilince kabul, kaldırılınca REDDEDİLİR."),
    ("İmza Defteri", "Gün bazlı giriş/çıkış/mola tablosu; operatör manuel imza da alabilir.", "Terminaldeki her geçiş buraya düşer."),
    ("Kapı İmza", "Yüz/kart doğrulama OLAY kayıtları (yalnız okuma, ilk 200 olay).", "Kayıt olmaması devamsızlık demek değildir."),
    ("İstirahat", "Yemek/çay/namaz molaları; açık molalar canlı sayılır.", "Mola bitince süre puantaja işlenir."),
]
FACE_2 = [
    ("Vardiyalar", "Mesai planı: başlangıç-bitiş, mola hakkı ve geç toleransı.", "Terminal giriş saatini BUNA GÖRE değerlendirir."),
    ("İzin & Devamsızlık", "Yıllık/mazeret/rapor izinleri, onay akışı ve bakiye.", "Onaylı izin gününde mesai başlatma engellenir; SMTP açıksa mail gider."),
    ("Ziyaretçiler", "Ön kayıt + süreli TEK GEÇİŞLİK QR e-pass ve yazdırılabilir yaka kartı.", "İlk geçişte QR düşer; blacklist Güvenlik Merkezi’nden yönetilir."),
    ("Güvenlik Merkezi", "Anti-passback, zone doluluk, blacklist, hayalet tespiti, spoof galerisi.", "Anti-passback açıkken çıkışsız tekrar giriş ALARM üretir."),
    ("Acil Durum Yoklaması", "Yangın/tahliye anında içeridekilerin sayımı (roll-call).", "Güvenlik Merkezi’nde ‘Yoklamayı Başlat’; eksikler listelenir."),
    ("PDKS Bordro Özeti", "Puantajdan bordro hakedişine: fazla mesai %50, resmi tatil ayrıca.", "Onayla → kilitle → CSV indir (Logo/Paraşüt/Mikro)."),
    ("Raporlar", "Tarih aralığında çalışma, istirahat, geç kalma ve devamsızlık dökümü.", "Tek tıkla CSV: bordro öncesi İK dökümü."),
    ("Sistem & KVKK", "KVKK alternatif kimlikleri, yemekhane, offline dayanıklılık ayarları.", "TC maskeleme açıldığında yalnız son 4 hane görünür."),
]
P26_1 = [
    ("Nöbet Çizelgesi", "Dönem için vardiya atamaları; izinliler otomatik dışarıda kalır.", "‘Otomatik dağıt’ ile dengeli çizelge, çıktısı Yazdır / PDF."),
    ("Puantaj Cetveli", "Aylık gün gün çalışma cetveli (gelme, çalışma, mola, eksik).", "Dönem seç → ‘Yazdır / PDF’ ile imza alanlı resmi çıktı."),
    ("Maaş Bordro", "Puantaj üzerinden otomatik ücret hesabı.", "Gün ve mesai aktıkça bordro kendiliğinden hesaplanır."),
    ("Vardiya Şablonları", "2’li / 3’lü düzenler ve özel şablonlar.", "Şablon eklenince nöbet dağıtımına girer."),
    ("Servis & Kadro", "Personel ekleme, düzenleme, servis/grup atama.", "Eklenen personel nöbet, puantaj, bordro ve analizde anında görünür."),
    ("TC Personel Sorgu", "Şifresiz, sadece TC ile sorgu ekranı (/personel-sorgu).", "Görevli TC’yi yazar; izin ve nöbet bilgisi okunur."),
    ("Resmi İzin Onayları", "Taleplerin onay/red akışı ve yıllık bakiye.", "Onaylanan gün puantaj/nöbetten düşer; karar e-postası gider."),
]
P26_2 = [
    ("Nöbet Değişimi", "Personelin birbirleriyle nöbet takas talepleri.", "Onaylayınca çizelgede yer değiştirir, analiz yenilenir."),
    ("Adalet Analizi", "Nöbetlerin personele göre dağılım dökümü.", "Kim kaç nöbet tutmuş, dengesizliği görüp düzeltin."),
    ("Mevzuat Uyarıları", "Dinlenme süresi ihlali ve haftalık/aylık limit aşımı uyarıları.", "Sıkışık program kurulduğunda uyarı üretilir."),
    ("Servis Duyuruları", "Servislere yönelik duyuru ve bildirimler.", "Eklenen duyuru ilgili sayfalarda görüntülenir."),
    ("Veri Yedekleme", "JSON/SQL yedek, geri yükleme önizlemesi ve şema çıktısı.", "Günlük otomatik yedek 19:00’da data/backups’a düşer (Windows)."),
    ("Kurum & Sistem Ayarları", "Kurum bilgisi/logo, 20+ tema, Excel aktarımı, SMTP, sistem bilgisi.", "SMTP yalnız sunuculu (Windows) sürümünde gönderir."),
]


def build():
    pdf = Sunum()
    tmp = pdf.tmp
    total = 14

    panel_mock = draw_panel_mock(tmp)
    terminal_mock = draw_terminal_mock(tmp)
    cover = photo(os.path.join(SCENES, "turnstile.jpg"), "cover.jpg", (2480, 1754), tmp, ramp="left", strength=0.97, dark=0.66)
    office = photo(os.path.join(SCENES, "office.jpg"), "office.jpg", (2480, 560), tmp, ramp="all", strength=0.8, dark=0.72)
    server = photo(os.path.join(SCENES, "server.jpg"), "server.jpg", (1200, 900), tmp, ramp="all", strength=0.7, dark=0.72)
    gate = photo(os.path.join(SCENES, "gate.jpg"), "gate.jpg", (2480, 1754), tmp, ramp="all", strength=0.9, dark=0.5)

    # ---------------------------------------------------------- 1 · kapak
    pdf.add_page()
    pdf.image(cover, x=0, y=0, w=W, h=H)
    pdf.set_fill_color(*AMBER)
    pdf.rect(0, 0, W, 2.4, style="F")
    pdf.one(ML, 46, 160, "KAPI GEÇİŞ · BIYOMETRİK YÜZ TANIMA · PDKS / PUANTAJ", size=9.5, color=AMBER, bold=True)
    pdf.para(ML, 56, 210, "SecurityPoint", size=44, color=WHITE, bold=True, leading=1.2)
    pdf.para(ML, 84, 230, "ORION FaceGate × Puantaj26", size=22, color=CYAN, bold=True, leading=1.3)
    pdf.para(
        ML,
        100,
        175,
        "Yüz tanımalı kapı geçişi ile resmi nöbet, puantaj ve bordroyu tek sistemde birleştiren ücretsiz, açık kaynak kurum platformu.",
        size=11.5,
        color=(214, 224, 240),
        leading=1.5,
        max_lines=4,
    )
    # rozetler
    bx = ML
    for label, fg, bg in [("ÜCRETSİZ", GREEN, (10, 46, 36)), ("AÇIK KAYNAK", CYAN, (12, 40, 58)), ("KURUM İÇİ", AMBER, (56, 44, 12))]:
        wdt = 6 + len(label) * 1.75
        pdf.chip(bx, 140, wdt, 8, label, fg, bg, size=8)
        bx += wdt + 4
    pdf.set_draw_color(*BORDER)
    pdf.line(ML, 158, 150, 158)
    pdf.one(ML, 163, 200, "Canlı panel:  cehennemgibiyim.github.io/SecurityPoint", size=10, color=WHITE, bold=True)
    pdf.one(ML, 170, 200, "Kaynak depo:  github.com/CehennemGibiyim/SecurityPoint", size=10, color=SLATE)
    pdf.one(ML, 177, 200, "Windows kurulum (.exe) · GitHub Pages · Kiosk modu", size=10, color=SLATE)
    pdf.sayfa_no(1, total)

    # ---------------------------------------------------------- 2 · neden
    y = pdf.head(
        "Neden SecurityPoint?",
        "Tek depoda iki sistem: kapı geçiş + resmi puantaj",
        "Biyometrik kapı verisi ile İK’nın puantaj/nöbet/bordro ihtiyacı aynı veritabanında buluşur; birbirine entegre çalışır.",
        accent=CYAN,
        page_no=2,
        total=total,
    )
    cards = [
        ("Ücretsiz & açık kaynak", "Hiçbir modül ücret istemez. E-posta dahil tüm işlevler kendi hesabınızla çalışır; kaynak depoda açıktır.", GREEN),
        ("İki modül, tek veri", "Personel kartı bir kez açılır; kapı sistemi ve Puantaj26 aynı kaydı paylaşır. Çift giriş yok.", CYAN),
        ("Yüz tanımalı geçiş", "Yüz + canlılık kontrolü ile turnike/kapı; yetkisiz deneme anında reddedilir ve fotoğraflanır.", VIOLET),
        ("Resmi çıktılar", "Puantaj cetveli ve nöbet çizelgesi Yazdır/PDF; bordro ve raporlar CSV (Logo/Paraşüt/Mikro uyumlu).", AMBER),
        ("Üç dağıtım", "GitHub Pages (ücretsiz barındırma), Windows kurulum .exe (yerel PostgreSQL) ve kapı için Kiosk modu.", CYAN),
        ("KVKK duyarlı", "TC maskeleme, yetki matrisi, işlem geçmişi; PIN pakette düz metin durmaz.", ROSE),
    ]
    cw, chh, gap = (W - ML - MR - 2 * 6) / 3, 46, 6
    for i, (t, b, col) in enumerate(cards):
        x = ML + (i % 3) * (cw + gap)
        yy = y + (i // 3) * (chh + gap)
        pdf.card(x, yy, cw, chh)
        pdf.set_fill_color(*col)
        pdf.rect(x + 5, yy + 5, 3.2, 10, style="F", round_corners=True, corner_radius=1.6)
        pdf.para(x + 12, yy + 5, cw - 17, t, size=12, color=WHITE, bold=True, max_lines=1)
        pdf.para(x + 12, yy + 15, cw - 18, b, size=8.8, color=SLATE, leading=1.45, max_lines=5)
    pdf.image(office, x=ML, y=y + 2 * (chh + gap) + 4, w=W - ML - MR, h=30)
    pdf.set_fill_color(*BG)
    pdf.one(ML + 6, y + 2 * (chh + gap) + 15, 150, "Anadolu Endüstri & Sağlık · tek çalışma alanı", size=9, color=(220, 228, 240), bold=True)

    # ---------------------------------------------------------- 3 · mimari
    y = pdf.head(
        "Nasıl çalışır?",
        "Ücretsiz barındırma, taşınabilir kurulum, otomatik test",
        "Aynı kod tabanı üç şekilde çalışır: tarayıcıda (sunucusuz), Windows’ta (yerel sunucuyla) ve her push’ta otomatik test edilir.",
        accent=VIOLET,
        page_no=3,
        total=total,
    )
    col_w = (W - ML - MR - 6 - 96) / 2
    pdf.card(ML, y, col_w, 74)
    pdf.para(ML + 7, y + 6, col_w - 14, "① GitHub Pages", size=12.5, color=CYAN, bold=True, max_lines=1)
    pdf.para(ML + 7, y + 13, col_w - 14, "canlı panel — ücretsiz barındırma", size=8.2, color=SLATE_D, bold=True, max_lines=1)
    for i, line in enumerate([
        "pages.yml her push’ta paneli derler ve yayınlar",
        "PostgreSQL (WASM) tarayıcıda çalışır, veri IndexedDB’de",
        "Sunucu gerekmez · barındırma ücretsiz",
        "Yedek: manuel JSON/SQL indirme",
    ]):
        pdf.bullet(ML + 7, y + 23 + i * 12, col_w - 14, line, size=8.6)

    x2 = ML + col_w + 6
    pdf.card(x2, y, col_w, 74)
    pdf.para(x2 + 7, y + 6, col_w - 14, "② Windows kurulumu", size=12.5, color=AMBER, bold=True, max_lines=1)
    pdf.para(x2 + 7, y + 13, col_w - 14, ".exe · yerel sunucu ile tam sürüm", size=8.2, color=SLATE_D, bold=True, max_lines=1)
    for i, line in enumerate([
        "Node.js + PostgreSQL pakete gömülü, ayrı kurulum yok",
        "Otomatik açılış ve 19:00 günlük SQL yedek seçeneği",
        "E-posta (SMTP) ve tam yedek bu sürümde çalışır",
        "Kapı ekranı için Kiosk modu + tek tık Başlat/Durdur",
    ]):
        pdf.bullet(x2 + 7, y + 23 + i * 12, col_w - 14, line, size=8.6, dot=AMBER)

    ix = x2 + col_w + 6
    pdf.image(server, x=ix, y=y, w=90, h=67.5)
    pdf.one(ix, y + 70, 90, "Veri kurumunuzda kalır", size=9, color=SLATE, bold=True, align="C")

    y2 = y + 84
    pdf.card(ML, y2, W - ML - MR, 34, fill=PANEL2)
    pdf.para(ML + 8, y2 + 6, 74, "③ CI otomasyonu", size=12.5, color=GREEN, bold=True, max_lines=1)
    pdf.para(ML + 8, y2 + 17, 74, "GitHub Actions", size=8.6, color=SLATE, max_lines=2)
    steps = ["Typecheck & build", "API/Pages testleri", "Tarayıcı testleri", "Windows paketi", "Pages’e yayın"]
    sx = ML + 92
    sw = (W - ML - MR - 92 - 4 * 6) / 5
    for i, s in enumerate(steps):
        xx = sx + i * (sw + 6)
        pdf.set_fill_color(*PANEL)
        pdf.rect(xx, y2 + 7, sw, 20, style="DF", round_corners=True, corner_radius=2.5)
        pdf.para(xx + 2, y2 + 12.5, sw - 4, s, size=7.4, color=WHITE, bold=True, leading=1.3, max_lines=2)
        pdf.set_text_color(*WHITE)
        if i < len(steps) - 1:
            pdf.one(xx + sw, y2 + 13, 6, "›", size=11, color=SLATE_D, bold=True, align="C")

    # ---------------------------------------------------------- 4 · ekranlar
    y = pdf.head(
        "Ekranlardan bir bakış",
        "Canlı panel ve kapı terminali",
        "Solda yönetim paneli (canlı nabız, kim içeride, anlık geçişler), sağda kapıdaki yüz terminali: onay ve reddin birlikte göründüğü akış.",
        accent=GREEN,
        page_no=4,
        total=total,
    )
    pdf.image(panel_mock, x=ML, y=y, w=166)
    th_ = 166 * 1120 / 1800
    pdf.image(terminal_mock, x=ML + 172, y=y, w=W - ML - MR - 172)
    tw_ = (W - ML - MR - 172) * 950 / 1400
    yy = y + max(th_, tw_) + 6
    pdf.one(ML, yy, 166, "Yönetim paneli — temsilî görünüm", size=8.5, color=SLATE_D, align="C")
    pdf.one(ML + 172, yy, W - ML - MR - 172, "Kapı terminali — temsilî görünüm (onay / red)", size=8.5, color=SLATE_D, align="C")
    pdf.card(ML, yy + 7, W - ML - MR, 26, fill=PANEL2)
    pdf.para(ML + 8, yy + 12, W - ML - MR - 16,
             "Gerçek ekran görüntüsü yerine temsilî çizimler kullanılmıştır; içerik ve yerleşim canlı paneldekiyle aynı ailede tasarlanmıştır.",
             size=8.6, color=SLATE, max_lines=2)

    # ---------------------------------------------------------- 5 · menü haritası
    y = pdf.head(
        "Menü haritası",
        "İki grup, 29 menü",
        "Sol menüde ‘Kapı Geçiş Sistemi’ ve ‘Personel26’ olmak üzere iki ana grup; en altta tek başına ‘Yardım → Kullanım Kılavuzu’.",
        accent=AMBER,
        page_no=5,
        total=total,
    )
    colw = (W - ML - MR - 8) / 2
    face_items = [
        ("Canlı Panel", "tesis nabzı · canlı sayaçlar"),
        ("Yüz Terminali", "kapı ekranı · yüz okuma"),
        ("Personel & Biyometri", "kadro + yüz şablonu"),
        ("Kapılar", "kapı noktaları ve kilit"),
        ("Kapı Yetkileri", "kim, hangi kapı, ne zaman"),
        ("İmza Defteri", "günlük giriş/çıkış/mola"),
        ("Kapı İmza", "geçiş olay kayıtları"),
        ("İstirahat", "mola takibi"),
        ("Vardiyalar", "mesai planı & tolerans"),
        ("İzin & Devamsızlık", "talep, onay, bakiye"),
        ("Ziyaretçiler", "tek geçişlik QR e-pass"),
        ("Güvenlik Merkezi", "anti-passback, alarm"),
        ("Acil Durum Yoklaması", "tahliye roll-call"),
        ("PDKS Bordro Özeti", "hakediş + CSV bordro"),
        ("Raporlar", "devam/mola dökümü + CSV"),
        ("Sistem & KVKK", "KVKK ve sistem ayarları"),
    ]
    p26_items = [
        ("Nöbet Çizelgesi", "otomatik vardiya dağıtımı"),
        ("Puantaj Cetveli", "aylık cetvel + PDF"),
        ("Maaş Bordro", "otomatik ücret hesabı"),
        ("Vardiya Şablonları", "2’li / 3’lü düzenler"),
        ("Servis & Kadro", "personel & servis yönetimi"),
        ("TC Personel Sorgu", "şifresiz sorgu ekranı"),
        ("Resmi İzin Onayları", "onay akışı + e-posta"),
        ("Nöbet Değişimi", "takas talepleri"),
        ("Adalet Analizi", "dağılım dökümü"),
        ("Mevzuat Uyarıları", "dinlenme & limit uyarıları"),
        ("Servis Duyuruları", "servis bildirimleri"),
        ("Veri Yedekleme", "JSON/SQL yedek & geri yükleme"),
        ("Kurum & Sistem Ayarları", "tema, Excel, SMTP, PIN"),
    ]
    for ci, (title, items, accent) in enumerate([("KAPI GEÇİŞ SİSTEMİ", face_items, CYAN), ("PERSONEL26", p26_items, AMBER)]):
        cx = ML + ci * (colw + 8)
        pdf.card(cx, y, colw, 150)
        pdf.set_fill_color(*accent)
        pdf.rect(cx, y, colw, 10, style="F", round_corners=True, corner_radius=3)
        pdf.set_fill_color(*PANEL)
        pdf.rect(cx, y + 6, colw, 6, style="F")
        pdf.one(cx + 6, y + 1.2, colw - 12, f"{title}  ·  {len(items)} menü", size=8.6, color=(10, 16, 28), bold=True)
        rh = 136 / max(len(items), 1)
        for i, (label, desc) in enumerate(items):
            ry = y + 13 + i * rh
            pdf.set_fill_color(*accent)
            pdf.rect(cx + 7, ry + rh / 2 - 1.6, 3.2, 3.2, style="F", round_corners=True, corner_radius=0.8)
            pdf.one(cx + 14, ry + rh / 2 - 2.6, colw * 0.46, label, size=8.8, color=WHITE, bold=True)
            pdf.one(cx + 14 + colw * 0.47, ry + rh / 2 - 2.3, colw * 0.5, desc, size=8.0, color=SLATE)

    # ---------------------------------------------------------- 6-9 · menü detay
    def menu_page(kicker, title, subtitle, data, page_no, accent):
        yy = pdf.head(kicker, title, subtitle, accent=accent, page_no=page_no, total=total)
        cardw = (W - ML - MR - 6) / 2
        cardh, gap = 36.5, 4
        for i, (label, what, effect) in enumerate(data):
            x = ML + (i % 2) * (cardw + 6)
            cy = yy + (i // 2) * (cardh + gap)
            pdf.card(x, cy, cardw, cardh)
            pdf.set_fill_color(*accent)
            pdf.rect(x, cy + 4, 2.6, cardh - 8, style="F", round_corners=True, corner_radius=1.3)
            pdf.para(x + 7, cy + 4, cardw - 14, label, size=11.5, color=WHITE, bold=True, max_lines=1)
            pdf.para(x + 7, cy + 12.5, cardw * 0.54, what, size=8.3, color=SLATE, leading=1.42, max_lines=4)
            ex, ew = x + cardw * 0.58, cardw * 0.39
            pdf.set_fill_color(30, 26, 12)
            pdf.rect(ex, cy + 11.5, ew, cardh - 15.5, style="F", round_corners=True, corner_radius=2)
            pdf.para(ex + 4, cy + 14, ew - 8, "NE EKLERSEN NE OLUR", size=6.4, color=AMBER, bold=True, max_lines=1)
            pdf.para(ex + 4, cy + 18.5, ew - 8, effect, size=7.8, color=(240, 226, 180), leading=1.38, max_lines=4)

    menu_page("Kapı Geçiş Sistemi · 1/2", "Canlı denetim ve biyometri", "Yüzden kapıya, kapıdan imza defterine uzanan günlük operasyon akışı.", FACE_1, 6, CYAN)
    menu_page("Kapı Geçiş Sistemi · 2/2", "Planlama, ziyaretçi ve güvenlik", "Mesai planı, izinler, ziyaretçi QR’ı ve saha güvenlik kuralları.", FACE_2, 7, ROSE)
    menu_page("Personel26 · 1/2", "Çalışma alanı menüleri", "Nöbetten puantaja, oradan bordroya uzanan resmi İK zinciri.", P26_1, 8, AMBER)
    menu_page("Personel26 · 2/2", "Yönetim ve sistem menüleri", "Analiz, uyarılar, duyurular, yedek ve kurum ayarları.", P26_2, 9, VIOLET)

    # ---------------------------------------------------------- 10 · akış
    y = pdf.head(
        "Ne eklersen ne olur?",
        "Bir kayıt ekleyin, tüm sistem güncellensin",
        "Veri bir kez girilir; kapı geçişi, puantaj, bordro ve analizler aynı kayıttan beslenir.",
        accent=GREEN,
        page_no=10,
        total=total,
    )

    def flow(y0, title, steps, accent):
        pdf.card(ML, y0, W - ML - MR, 58, fill=PANEL2)
        pdf.para(ML + 8, y0 + 6, 200, title, size=12, color=accent, bold=True, max_lines=1)
        n = len(steps)
        bw = (W - ML - MR - 16 - (n - 1) * 14) / n
        bx = ML + 8
        for i, (head, sub) in enumerate(steps):
            pdf.set_fill_color(*PANEL)
            pdf.set_draw_color(*accent)
            pdf.set_line_width(0.4)
            pdf.rect(bx, y0 + 18, bw, 30, style="DF", round_corners=True, corner_radius=2.5)
            pdf.para(bx + 4, y0 + 20.5, bw - 8, head, size=8.2, color=WHITE, bold=True, leading=1.3, max_lines=2)
            pdf.para(bx + 4, y0 + 31, bw - 8, sub, size=7.4, color=SLATE, leading=1.3, max_lines=2)
            if i < n - 1:
                pdf.one(bx + bw, y0 + 27, 14, "→", size=13, color=accent, bold=True, align="C")
            bx += bw + 14

    flow(
        y,
        "KAPI GEÇİŞ AKIŞI",
        [
            ("Personel + yüz kaydı", "Kadro’dan tek seferlik"),
            ("Kapı + yetki", "Hangi kapı, hangi saat"),
            ("Terminal okuması", "Canlılık kontrolü"),
            ("İmza defteri", "Giriş/çıkış/mola kaydı"),
            ("Puantaj & bordro", "Otomatik hesap"),
        ],
        CYAN,
    )
    flow(
        y + 66,
        "NÖBET / PUANTAJ AKIŞI",
        [
            ("Servis & kadro", "Departman + gruplar"),
            ("Vardiya şablonu", "2’li / 3’lü düzen"),
            ("Otomatik dağıtım", "İzinli personel hariç"),
            ("Adalet analizi", "Denge kontrolü"),
            ("Yazdır / PDF", "Resmi çıktı"),
        ],
        AMBER,
    )
    y3 = y + 132
    pdf.card(ML, y3, W - ML - MR, 26, fill=PANEL)
    pdf.para(
        ML + 8,
        y3 + 6,
        W - ML - MR - 16,
        "Ayrıca: izin onaylayınca Puantaj26 ve terminal senkron güncellenir · kişi/grup ekleyince dağılım ve analiz yeniden hesaplanır · kapı kilitlenince yetki aranmaz · ziyaretçi QR’ı ilk geçişte kendiliğinden geçersizleşir.",
        size=8.8,
        color=SLATE,
        max_lines=2,
    )

    # ---------------------------------------------------------- 11 · çıktılar
    y = pdf.head(
        "Çıktılar",
        "PDF, CSV ve ücretsiz e-posta",
        "Resmi belgeler yazdırma önizlemesinden alınır; bordro/raporlar CSV’ye aktarılır; izin kararları kendi e-posta hesabınızdan bildirilir.",
        accent=CYAN,
        page_no=11,
        total=total,
    )
    # beyaz kağıt önizleme
    px, py, pw, ph = ML, y, 158, 118
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(px, py, pw, ph, style="DF", round_corners=True, corner_radius=2)
    pdf.one(px + 8, py + 7, 100, "PUANTAJ CETVELİ", size=11, color=(15, 23, 42), bold=True)
    pdf.one(px + 8, py + 14, 140, "ANADOLU ENDÜSTRI & SAĞLIK · EKİM 2026", size=7.5, color=(71, 85, 105))
    pdf.one(px + pw - 50, py + 7, 42, "Sayfa 1/1", size=7.5, color=(100, 116, 139), align="R")
    cols = ["Personel", "G", "D", "Ç.Sa", "Mola", "Geç", "Nöbet", "Durum"]
    tw = [50, 11, 11, 15, 13, 11, 15, 16]
    tx, ty, rh = px + 8, py + 22, 8.6
    pdf.set_fill_color(241, 245, 249)
    pdf.rect(tx, ty, sum(tw), rh, style="F")
    cxx = tx
    for c, cwid in zip(cols, tw):
        pdf.one(cxx + 1.5, ty + 1.6, cwid, c, size=7.5, color=(30, 41, 59), bold=True)
        cxx += cwid
    rows = [
        ("Ayşe Yılmaz", "22", "0", "176", "45", "12", "4", "Tam"),
        ("Mehmet Demir", "21", "1", "168", "45", "0", "6", "Tam"),
        ("Zeynep Kaya", "20", "2", "160", "40", "24", "3", "Kısmi"),
        ("Ali Çelik", "18", "4", "144", "45", "6", "5", "Eksik"),
        ("Elif Arslan", "22", "0", "176", "45", "0", "4", "Tam"),
    ]
    for ri, row in enumerate(rows):
        yy2 = ty + rh * (ri + 1)
        if ri % 2 == 1:
            pdf.set_fill_color(248, 250, 252)
            pdf.rect(tx, yy2, sum(tw), rh, style="F")
        cxx = tx
        for val, cwid in zip(row, tw):
            col = (15, 23, 42) if cxx == tx else (51, 65, 85)
            pdf.one(cxx + 1.5, yy2 + 1.6, cwid, val, size=7.5, color=col, bold=(cxx == tx))
            cxx += cwid
    pdf.set_draw_color(203, 213, 225)
    pdf.line(px + 8, py + ph - 16, px + 60, py + ph - 16)
    pdf.line(px + 68, py + ph - 16, px + 120, py + ph - 16)
    pdf.one(px + 8, py + ph - 13.4, 52, "İmza (Hazırlayan)", size=7, color=(100, 116, 139))
    pdf.one(px + 68, py + ph - 13.4, 52, "İmza (Onaylayan)", size=7, color=(100, 116, 139))

    rx = px + pw + 6
    rw = W - MR - rx
    out_cards = [
        ("Yazdır / PDF", "Puantaj cetveli ve nöbet çizelgesi; dönem seçimi, imza alanlı önizleme, tarayıcıdan ‘PDF olarak kaydet’.", CYAN),
        ("CSV çıktılar", "Bordro (Logo/Paraşüt/Mikro uyumlu) ve devam/mola raporları tek tıkla indirilir.", GREEN),
        ("E-posta (ücretsiz)", "Ayarlar → Bildirimler → SMTP: Gmail/Outlook uygulama şifresiyle izin onay/red bildirimi. Ek ücretli servis yok.", AMBER),
    ]
    ch2 = 37
    for i, (t, b, col) in enumerate(out_cards):
        cy = y + i * (ch2 + 3.5)
        pdf.card(rx, cy, rw, ch2)
        pdf.set_fill_color(*col)
        pdf.rect(rx + 5, cy + 5, 3.2, 10, style="F", round_corners=True, corner_radius=1.6)
        pdf.para(rx + 12, cy + 5, rw - 17, t, size=11.5, color=WHITE, bold=True, max_lines=1)
        pdf.para(rx + 12, cy + 15, rw - 18, b, size=8.4, color=SLATE, leading=1.45, max_lines=4)

    # ---------------------------------------------------------- 12 · kurulum
    y = pdf.head(
        "Kurulum & erişim",
        "Üç dakikada çalışmaya başlayın",
        "Canlı paneli açın, Windows’u kurun veya kapı ekranını kiosk modunda çalıştırın — hepsi ücretsiz.",
        accent=AMBER,
        page_no=12,
        total=total,
    )
    install = [
        ("A · Canlı panel", CYAN, [
            "cehennemgibiyim.github.io/SecurityPoint adresini açın",
            "Yönetici girişi ile oturum açın (30 gün geçerli)",
            "Ayarlar → Veri Aktarımı ile personeli yükleyin",
            "Veriler tarayıcıda saklanır — düzenli yedek alın",
        ]),
        ("B · Windows kurulumu", AMBER, [
            "Actions → windows-test → Artifacts’ten .exe’yi indirin",
            "Kurun; Node.js + PostgreSQL pakete gömülüdür",
            "Kurulumda otomatik açılış + günlük yedek seçeneği",
            "Kapı ekranı için Personel26 Kiosk kısayolu hazır",
        ]),
        ("C · Kapı terminali", GREEN, [
            "/terminal?kiosk=1 ile tam ekran kapı modu",
            "ESC ile tam ekrandan çıkılır",
            "Her kapı için ayrı sekme/cihaz açılabilir",
            "Yetki, yüz ve vardiya kontrolü terminalde yapılır",
        ]),
    ]
    cw3 = (W - ML - MR - 2 * 6) / 3
    for i, (title, col, lines) in enumerate(install):
        x = ML + i * (cw3 + 6)
        pdf.card(x, y, cw3, 74)
        pdf.set_fill_color(*col)
        pdf.rect(x, y, cw3, 11, style="F", round_corners=True, corner_radius=3)
        pdf.set_fill_color(*PANEL)
        pdf.rect(x, y + 7, cw3, 5, style="F")
        pdf.one(x + 7, y + 1.6, cw3 - 14, title, size=10.5, color=(10, 16, 28), bold=True)
        for j, line in enumerate(lines):
            pdf.bullet(x + 7, y + 17 + j * 14.2, cw3 - 14, line, size=8.6, dot=col)
    pdf.card(ML, y + 82, W - ML - MR, 30, fill=PANEL2)
    pdf.para(
        ML + 8,
        y + 88,
        W - ML - MR - 16,
        "Tek seferlik Pages ayarı: Repo → Settings → Pages → Source = GitHub Actions (branch değil). Windows kurulumu sistemde Node/PostgreSQL kurulumu gerektirmez; ‘Veriyi koruyarak güncelleme’ ile yükseltilir.",
        size=9,
        color=SLATE,
        max_lines=2,
    )

    # ---------------------------------------------------------- 13 · güvenlik
    y = pdf.head(
        "Güvenlik & ücretsiz servisler",
        "Kurum içi kullanım için hazır",
        "Hiçbir özellik ücretli kilit değildir: PIN, KVKK maskeleme, otomatik yedek ve e-posta dahil hepsi açıktır.",
        accent=ROSE,
        page_no=13,
        total=total,
    )
    sec = [
        ("Yönetici PIN kapısı", "Panel ve kapı terminali kullanıcı adı + PIN ister. PIN pakette düz metin durmaz (SHA-256 özeti), oturum 30 gün imzalıdır."),
        ("KVKK maskeleme", "TC kimlikler listelerde yalnız son 4 haneyle görünür; yetkisiz personel kartı açamaz, işlem geçmişi tutulur."),
        ("Otomatik yedek (Windows)", "Günlük 19:00 SQL yedeği data/backups klasörüne; geri yüklemede eksik veri onayı reddedilir, başarısız işlem geri alınır."),
        ("Anti-passback & alarm", "Çıkış yapmadan tekrar giriş engellenir; yetkisiz deneme, spoof ve hayalet kayıtları güvenlik merkezinde toplanır."),
        ("Acil durum protokolü", "Yangın/alarmda kapılar süre boyunca serbest açılır; işlem + sorumlu adı imza defterine yazılır, alarm üretilir."),
        ("Ücretsiz e-posta", "Kendi Gmail/Outlook hesabınızın uygulama şifresiyle izin kararları bildirilir. Aylık abonelik, kredi kartı yoktur."),
    ]
    cw4 = (W - ML - MR - 2 * 6) / 3
    for i, (t, b) in enumerate(sec):
        x = ML + (i % 3) * (cw4 + 6)
        yy = y + (i // 3) * (52 + 6)
        pdf.card(x, yy, cw4, 52)
        pdf.set_fill_color(*ROSE)
        pdf.rect(x + 5, yy + 5, 3.2, 10, style="F", round_corners=True, corner_radius=1.6)
        pdf.para(x + 12, yy + 5, cw4 - 17, t, size=11.5, color=WHITE, bold=True, max_lines=1)
        pdf.para(x + 12, yy + 15, cw4 - 18, b, size=8.6, color=SLATE, leading=1.45, max_lines=5)
    pdf.image(office, x=ML, y=y + 2 * (52 + 6) + 2, w=W - ML - MR, h=26)

    # ---------------------------------------------------------- 14 · kapanış
    pdf.add_page()
    pdf.image(gate, x=0, y=0, w=W, h=H)
    pdf.set_fill_color(*CYAN)
    pdf.rect(0, 0, W, 2.4, style="F")
    pdf.para(ML, 52, 220, "Ücretsiz. Açık kaynak.", size=34, color=WHITE, bold=True, leading=1.25)
    pdf.para(ML, 74, 220, "Kurumunuza hazır.", size=34, color=CYAN, bold=True, leading=1.25)
    pdf.para(
        ML,
        100,
        170,
        "Kapı geçiş (biyometrik yüz tanıma) + PDKS / puantaj paneli tek depoda. Denemek için canlı paneli açın, kurulumu Actions’tan indirin.",
        size=11,
        color=(216, 226, 242),
        leading=1.5,
        max_lines=4,
    )
    links = [
        ("Canlı panel", "cehennemgibiyim.github.io/SecurityPoint"),
        ("Kaynak depo", "github.com/CehennemGibiyim/SecurityPoint"),
        ("Uygulama içi kılavuz", "Sol menü → Yardım → Kullanım Kılavuzu"),
        ("Kurulum (.exe)", "GitHub Actions → windows-test → Artifacts"),
    ]
    ly = 136
    for i, (label, val) in enumerate(links):
        yy = ly + i * 13
        pdf.set_fill_color(*CYAN)
        pdf.rect(ML, yy + 1.6, 3, 3, style="F", round_corners=True, corner_radius=0.8)
        pdf.one(ML + 8, yy, 52, label, size=9.5, color=CYAN, bold=True)
        pdf.one(ML + 62, yy, 190, val, size=9.5, color=WHITE)
    pdf.sayfa_no(14, total)

    pdf.output(OUT_PDF)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"OK → {OUT_PDF} ({os.path.getsize(OUT_PDF) // 1024} KB)")


if __name__ == "__main__":
    build()