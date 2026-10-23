import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono, Manrope, Syne } from "next/font/google";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./settings.css";
import ThemeLoader from "@/components/ThemeLoader";
import BrowserDbGate from "@/components/BrowserDbGate";
import { BROWSER_BOOT_INLINE } from "@/lib/browser-db/inline-boot";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
});

const BROWSER_DB = process.env.NEXT_PUBLIC_P26_BROWSER_DB === "1";
const BASE_PATH = (process.env.NEXT_PUBLIC_P26_BASE_PATH ?? "").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "ORION FaceGate × Puantaj26 | Entegre Biyometrik PDKS & Nöbet/Puantaj Platformu",
  description:
    "ORION FaceGate yüz tanımalı PDKS, kapı yetki ve biyometrik stüdyo altyapısı ile Puantaj26 resmi nöbet, puantaj, bordro ve izin yönetim sistemi.",
};

export const viewport: Viewport = {
  themeColor: "#06080f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${manrope.variable} ${syne.variable} ${jetbrains.variable} antialiased`}>
        {BROWSER_DB ? (
          <>
            <script dangerouslySetInnerHTML={{ __html: BROWSER_BOOT_INLINE }} />
            <script type="module" src={`${BASE_PATH}/pglite/app.js`} />
          </>
        ) : null}
        <ThemeLoader />
        {BROWSER_DB ? <BrowserDbGate>{children}</BrowserDbGate> : children}
      </body>
    </html>
  );
}
