"use client";

/** Kök düzey hata sınırı: layout bile çökse kurtarma ekranı göster. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ background: "#070b14", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Uygulama hatası</h1>
          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 16, wordBreak: "break-word" }}>{error?.message || "Beklenmeyen bir hata oluştu."}</p>
          <button
            onClick={() => reset()}
            style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: "#0ea5e9", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >Tekrar Dene</button>
        </div>
      </body>
    </html>
  );
}
