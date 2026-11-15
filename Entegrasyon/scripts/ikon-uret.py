#!/usr/bin/env python3
"""SecurityPoint / ORION FaceGate uygulama ikonu üreticisi.

Kaynak: public/brand/orion-face-aurora.png (128x128, siyah zeminli "aurora" yüz).

Üretilenler:
  public/brand/securitypoint.ico -> Windows kurulum .exe, kısayollar, tarayıcı favicon'u
  src/app/favicon.ico            -> Next.js dosya kuralı (/favicon.ico)
  src/app/apple-icon.png         -> iOS ana ekran simgesi (180x180)
  public/brand/pwa-192.png       -> PWA manifest simgesi
  public/brand/pwa-512.png       -> PWA manifest simgesi
  public/brand/pwa-maskable-512.png -> PWA maskable simgesi (güvenli alan içinde)

Tek ikon kaynağı: `src/app/icon.svg` kaldırıldı; tarayıcı sekmesi, PWA ve Windows
paketi aynı üreticiden çıkan dosyaları kullanır.

Kullanım (Entegrasyon/ altında):
  python3 scripts/ikon-uret.py

Yeniden üretmek güvenlidir: aynı girdi aynı çıktıyı verir. Bağımlılık: Pillow.
"""
from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "brand" / "orion-face-aurora.png"
ICO_OUT = ROOT / "public" / "brand" / "securitypoint.ico"
FAVICON_OUT = ROOT / "src" / "app" / "favicon.ico"
APPLE_OUT = ROOT / "src" / "app" / "apple-icon.png"
PWA192_OUT = ROOT / "public" / "brand" / "pwa-192.png"
PWA512_OUT = ROOT / "public" / "brand" / "pwa-512.png"
PWA_MASKABLE_OUT = ROOT / "public" / "brand" / "pwa-maskable-512.png"

BASE = 512  # tüm boyutlar bu tabandan küçültülür (en büyük katman 256'nın 2 katı)

# Panelin koyu temasıyla aynı palet.
TOP = (13, 21, 38)
BOTTOM = (5, 7, 13)
GLOW = (34, 211, 238)
BORDER = (45, 212, 191)


def _rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def _vertical_gradient(size: int) -> Image.Image:
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        grad.putpixel(
            (0, y),
            tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    return grad.resize((size, size), Image.Resampling.NEAREST)


def _glow(size: int) -> Image.Image:
    """Yüzün arkasındaki yumuşak turkuaz hale."""
    layer = Image.new("L", (size, size), 0)
    r = int(size * 0.42)
    cx = cy = size // 2
    draw = ImageDraw.Draw(layer)
    for step in range(r, 0, -1):
        # Merkeze doğru artan yoğunluk, dışa doğru şeffaf.
        alpha = int(46 * (1 - step / r) ** 2)
        draw.ellipse((cx - step, cy - step, cx + step, cy + step), fill=alpha)
    layer = layer.filter(ImageFilter.GaussianBlur(size * 0.04))
    glow = Image.new("RGB", (size, size), GLOW)
    return Image.composite(glow, Image.new("RGB", (size, size), (0, 0, 0)), layer)


def build_base(art_ratio: float, border: bool, full_bleed: bool = False) -> Image.Image:
    """Tek bir tasarım tabanı: yuvarlatılmış koyu kutu + aurora yüz (screen karışım)."""
    size = BASE
    radius = int(size * 0.22)

    tile = _vertical_gradient(size).convert("RGB")
    tile = ImageChops.screen(tile, _glow(size))

    art = Image.open(SOURCE).convert("RGB")
    art_size = int(size * art_ratio)
    art = art.resize((art_size, art_size), Image.Resampling.LANCZOS)
    # Kaynak siyah zeminli: doğrudan yapıştırmak yerine screen ile birleştir,
    # böylece siyah kutu görünmez ve "aurora" parıltısı korunur.
    art_layer = Image.new("RGB", (size, size), (0, 0, 0))
    offset = (size - art_size) // 2
    art_layer.paste(art, (offset, offset))
    tile = ImageChops.screen(tile, art_layer)

    if border:
        overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        stroke = max(2, int(size * 0.012))
        draw.rounded_rectangle(
            (stroke // 2, stroke // 2, size - 1 - stroke // 2, size - 1 - stroke // 2),
            radius=radius,
            outline=(*BORDER, 96),
            width=stroke,
        )
        tile = Image.alpha_composite(tile.convert("RGBA"), overlay).convert("RGB")

    out = tile.convert("RGBA")
    if full_bleed:
        # Maskable simge: güvenli alanın dışı kırpıldığı için tam kare zemin.
        out.putalpha(Image.new("L", (size, size), 255))
    else:
        out.putalpha(_rounded_mask(size, radius))
    return out


def render(base: Image.Image, size: int) -> Image.Image:
    img = base.resize((size, size), Image.Resampling.LANCZOS)
    if size <= 24:
        # Küçük boyutlarda detay kaybını telafi et.
        img = img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=70, threshold=2))
    elif size <= 48:
        img = img.filter(ImageFilter.UnsharpMask(radius=1.4, percent=45, threshold=3))
    elif size >= 128:
        # Kaynak görsel 128x128: 128 ve 256 katmanları büyütmeyle geldiği için
        # hafif bir netleştirme uygulanır (256 için daha belirgin).
        percent = 30 if size == 128 else 42
        img = img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=percent, threshold=3))
    return img


def write_ico(images: list[tuple[int, Image.Image]], path: Path) -> None:
    """PNG sıkıştırmalı çok katmanlı ICO yazar (Vista+ tüm boyutlar için geçerli)."""
    entries = []
    payload = b""
    offset = 6 + 16 * len(images)
    for size, img in images:
        from io import BytesIO

        buf = BytesIO()
        img.save(buf, format="PNG", optimize=True)
        data = buf.getvalue()
        entries.append(
            struct.pack(
                "<BBBBHHII",
                0 if size >= 256 else size,
                0 if size >= 256 else size,
                0,
                0,
                1,
                32,
                len(data),
                offset,
            )
        )
        payload += data
        offset += len(data)

    header = struct.pack("<HHH", 0, 1, len(images))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + b"".join(entries) + payload)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Kaynak görsel bulunamadı: {SOURCE}")

    normal = build_base(art_ratio=0.74, border=True)
    compact = build_base(art_ratio=0.88, border=False)

    ico_sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    layers = [(s, render(compact if s <= 32 else normal, s)) for s in ico_sizes]
    write_ico(layers, ICO_OUT)
    write_ico(layers, FAVICON_OUT)

    apple = render(normal, 180).convert("RGB")
    APPLE_OUT.parent.mkdir(parents=True, exist_ok=True)
    apple.save(APPLE_OUT, format="PNG", optimize=True)

    # PWA simgeleri: normal (saydam köşeli) ve maskable (tam kare, güvenli alan).
    render(normal, 192).save(PWA192_OUT, format="PNG", optimize=True)
    render(normal, 512).save(PWA512_OUT, format="PNG", optimize=True)
    maskable = build_base(art_ratio=0.62, border=False, full_bleed=True)
    render(maskable, 512).save(PWA_MASKABLE_OUT, format="PNG", optimize=True)

    print(f"ICO      : {ICO_OUT.relative_to(ROOT)} ({ICO_OUT.stat().st_size} bayt, {len(layers)} katman)")
    print(f"Favicon  : {FAVICON_OUT.relative_to(ROOT)}")
    print(f"Apple    : {APPLE_OUT.relative_to(ROOT)} (180x180)")
    for p in (PWA192_OUT, PWA512_OUT, PWA_MASKABLE_OUT):
        print(f"PWA      : {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
