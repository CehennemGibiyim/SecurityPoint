export const dynamic = "force-dynamic";

/**
 * Statik arayüz önizlemesini index.html olarak indirir.
 *
 * Sunuculu sürümde dosya diskten okunur; GitHub Pages (statik) sürümünde ise
 * aynı dosya sitenin yanındaki `panel-onizleme.html` adresinden getirilir
 * (tarayıcı köprüsü üzerinden çalışır).
 */
async function readPreviewHtml(): Promise<Uint8Array | string> {
  const bridge = typeof window !== "undefined"
    ? (window as unknown as { __p26?: { assetUrl?: (p: string) => string } }).__p26
    : undefined;

  if (bridge?.assetUrl) {
    const res = await fetch(bridge.assetUrl("panel-onizleme.html"), { cache: "no-store" });
    if (!res.ok) throw new Error(`Önizleme dosyası bulunamadı (${res.status})`);
    return await res.text();
  }

  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = await readFile(path.join(process.cwd(), "public", "panel-onizleme.html"));
  return new Uint8Array(file);
}

export async function GET() {
  const html = await readPreviewHtml();
  const bytes = typeof html === "string" ? new TextEncoder().encode(html) : html;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="index.html"; filename*=UTF-8''index.html`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
