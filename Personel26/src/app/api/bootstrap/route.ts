import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";
import { databaseConfigured } from "@/db";

export const dynamic = "force-dynamic";

/** Uygulama açılış verisi. DB eksikliği derleme aşamasında değil,
 * çalışma anında anlaşılır 503 olarak döner. */
export async function GET() {
  if (!databaseConfigured) {
    return Response.json(
      { error: "DATABASE_URL ayarı bulunamadı. Windows portable pakette veritabanı ilk başlatmada otomatik kurulur; web dağıtımında PostgreSQL bağlantısını ekleyin." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const work = (async () => {
      await ensureSeeded();
      // Günlük yedek arka planda alınır, ilk ekranı bekletmez.
      ensureDailyBackup().catch(() => {});
      return getBootstrap();
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Sunucu zaman aşımına uğradı. Lütfen tekrar deneyin.")), 20000);
    });
    const data = await Promise.race([work, timeout]);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bootstrap hatası";
    const timed = msg.includes("zaman aşımına");
    return Response.json({ error: msg }, { status: timed ? 503 : 500, headers: { "Cache-Control": "no-store" } });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
