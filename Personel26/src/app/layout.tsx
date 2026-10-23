import type { Metadata, Viewport } from "next";
// Yazı tipleri kendi alan adımızdan sunulur (self-host): derleme sırasında
// internet erişimi gerekmez, GitHub Pages'te ek istek/kvkk riski oluşturmaz.
// Aile adları globals.css içinde --font-inter / --font-grotesk olarak tanımlıdır.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./settings.css";
import ThemeLoader from "@/components/ThemeLoader";
import { BROWSER_BOOT_INLINE } from "@/lib/browser-db/inline-boot";

/** GitHub Pages (statik) sürümü: veritabanı tarayıcıda çalışır. */
const BROWSER_DB = process.env.NEXT_PUBLIC_P26_BROWSER_DB === "1";
const BASE_PATH = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Personel26 — Puantaj ve Nöbet Yönetim Sistemi",
  description: "Sağlık kuruluşları için personel, nöbet, puantaj, izin ve raporlama yönetimi.",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "var(--font-inter)" }}>
        {BROWSER_DB ? (
          <>
            {/* Veritabanı köprüsü yüklenmeden önce hazır olması gereken küçük betik.
                Kasıtlı olarak senkron: modül betiği (pglite/app.js) çözülecek sözü
                ancak bu betik çalıştıktan sonra bulabilir. */}
            <script dangerouslySetInnerHTML={{ __html: BROWSER_BOOT_INLINE }} />
            {/* Tarayıcı içi PostgreSQL + API köprüsü (statik derlemede üretilir) */}
            <script type="module" src={`${BASE_PATH}/pglite/app.js`} />
          </>
        ) : null}
        <ThemeLoader />
        {children}
      </body>
    </html>
  );
}
