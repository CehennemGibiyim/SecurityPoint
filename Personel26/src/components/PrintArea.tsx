"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";

export function openPrintPreview() {
  if (typeof document !== "undefined") {
    document.body.classList.add("print-preview-open");
  }
}

export function closePrintPreview() {
  if (typeof document !== "undefined") {
    document.body.classList.remove("print-preview-open");
  }
}

type Orient = "portrait" | "landscape";

/** A4 ölçüleri (96 dpi, CSS piksel). */
const MM = 96 / 25.4;
const PAGE_MM: Record<Orient, [number, number]> = { portrait: [210, 297], landscape: [297, 210] };
const MARGIN_MM = 8;
/** Ekran ile yazıcı arasındaki küçük yazı tipi/yuvarlama farkları için pay. */
const SAFETY = 0.965;

function pageBox(o: Orient) {
  const [w, h] = PAGE_MM[o];
  return {
    pageW: w * MM, pageH: h * MM,
    availW: (w - 2 * MARGIN_MM) * MM, availH: (h - 2 * MARGIN_MM) * MM,
    margin: MARGIN_MM * MM,
  };
}

type Fit = { scale: number; orient: Orient; w: number; h: number };

/**
 * Yazdırma alanı — içerik HER ZAMAN TEK A4 SAYFAYA sığdırılır.
 *
 * 1) İçerik A4 yazdırılabilir genişliğinde ölçülür (dikey ve yatay).
 * 2) Tamamen sığan en büyük ölçek hesaplanır; "auto" modda dikey/yatay
 *    arasından daha büyük (daha okunaklı) olan seçilir.
 * 3) İçerik bu ölçekle küçültülür, kâğıt yönü @page ile ayarlanır.
 * Kaç personel, kaç hafta (5–6) olursa olsun çıktı tek sayfa ve eksiksizdir.
 *
 * İçerik body'ye portal ile taşınır (yazıcı modunda uygulama kabuğu gizlendiği için).
 * Hidrasyon güvenliği: portal yalnızca tarayıcıda, mount sonrası kurulur.
 */
export default function PrintArea({
  children,
  orientation = "auto",
}: {
  children: ReactNode;
  orientation?: "auto" | Orient;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<Fit>({ scale: 1, orient: "portrait", w: 0, h: 0 });
  const innerRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef(fit);
  const rafRef = useRef(0);

  const recompute = useCallback(() => {
    const el = innerRef.current;
    const area = document.getElementById("print-area");
    if (!el || !area) return;
    // Görünmüyorsa (önizleme kapalıyken Ctrl+P) ölçüm için geçici olarak ekran dışında göster
    const hidden = getComputedStyle(area).display === "none";
    if (hidden) document.body.classList.add("print-measuring");
    try {
      const options: Orient[] = orientation === "auto" ? ["portrait", "landscape"] : [orientation];
      let best: Fit | null = null;
      for (const o of options) {
        const { availW, availH } = pageBox(o);
        el.style.width = `${availW}px`;
        const w = Math.max(el.scrollWidth, availW);
        const h = el.scrollHeight;
        if (!h) continue;
        const scale = Math.min(1, (SAFETY * availW) / w, (SAFETY * availH) / h);
        if (!best || scale > best.scale + 0.005) best = { scale, orient: o, w, h };
      }
      if (!best) return;
      el.style.width = `${pageBox(best.orient).availW}px`;
      const next: Fit = {
        scale: Math.round(best.scale * 1000) / 1000,
        orient: best.orient,
        w: Math.ceil(best.w),
        h: Math.ceil(best.h),
      };
      const prev = fitRef.current;
      if (prev.scale !== next.scale || prev.orient !== next.orient || prev.w !== next.w || prev.h !== next.h) {
        fitRef.current = next;
        setFit(next);
      }
    } finally {
      if (hidden) document.body.classList.remove("print-measuring");
    }
  }, [orientation]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => recompute());
  }, [recompute]);

  // Kurulum: portal hedefi, ESC, yazdırma öncesi ölçüm, önizleme açılınca ölçüm
  useEffect(() => {
    setHost(document.body);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") closePrintPreview(); };
    const before = () => recompute();
    window.addEventListener("keydown", esc);
    window.addEventListener("beforeprint", before);
    const mo = new MutationObserver(() => {
      if (document.body.classList.contains("print-preview-open")) schedule();
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("keydown", esc);
      window.removeEventListener("beforeprint", before);
      mo.disconnect();
      cancelAnimationFrame(rafRef.current);
      closePrintPreview();
    };
  }, [recompute, schedule]);

  // İçerik değişince (veri yüklendi, bölüm seçildi, dipnot eklendi) yeniden sığdır
  useEffect(() => {
    const el = innerRef.current;
    if (!host || !el) return;
    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);
    schedule();
    return () => ro.disconnect();
  }, [host, schedule]);

  // Kâğıt yönü (dikey/yatay) — @page kuralı
  useEffect(() => {
    let tag = document.getElementById("p26-page-style") as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "p26-page-style";
      document.head.appendChild(tag);
    }
    tag.textContent = `@page { size: A4 ${fit.orient}; margin: ${MARGIN_MM}mm; }`;
  }, [fit.orient]);

  if (!host) return null;

  const box = pageBox(fit.orient);
  const pct = Math.round(fit.scale * 100);

  return createPortal(
    <>
      <div id="print-area">
        <div
          className="print-sheet"
          style={{ width: box.pageW, minHeight: box.pageH, padding: box.margin }}
        >
          <div
            className="print-fit-outer"
            style={{ width: fit.w ? fit.w * fit.scale : box.availW, height: fit.h ? fit.h * fit.scale + 1 : "auto" }}
          >
            <div
              ref={innerRef}
              className="print-fit-inner printdoc"
              style={{ width: box.availW, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
      <div className="print-toolbar">
        <span className={`print-fit-info ${fit.scale < 0.5 ? "is-dense" : ""}`}>
          Tek sayfa · A4 {fit.orient === "portrait" ? "dikey" : "yatay"} · %{pct} ölçek
          {fit.scale < 0.5 && " · yoğun içerik"}
        </span>
        <button
          type="button"
          onClick={() => { recompute(); requestAnimationFrame(() => window.print()); }}
          className="print-toolbar-btn primary"
        >
          <Printer className="w-4 h-4" /> Yazdır / PDF Kaydet
        </button>
        <button type="button" onClick={closePrintPreview} className="print-toolbar-btn">
          <X className="w-4 h-4" /> Önizlemeyi Kapat
        </button>
      </div>
    </>,
    host
  );
}
