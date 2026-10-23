import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getSettings, requireSameOrigin } from "@/lib/server/settings";
import { cleanCustomGroups, DEFAULT_SETTINGS } from "@/lib/settings";
export const dynamic = "force-dynamic";

/** Elle eklenen nöbet gruplarının listesi (personeli olmayanlar dahil). */
export async function GET() {
  try {
    return Response.json({ groups: (await getSettings()).customGroups ?? [] });
  } catch {
    return Response.json({ error: "Gruplar okunamadı." }, { status: 503 });
  }
}

/** Listeyi kaydeder; ayarlar tablosunda durduğu için yedeğe girer. */
export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.groups)) return Response.json({ error: "Geçersiz grup listesi." }, { status: 400 });
    const groups = cleanCustomGroups(body.groups);
    const current = await getSettings();
    const data = { ...DEFAULT_SETTINGS, ...current, customGroups: groups };
    await db.insert(appSettings).values({ id: "global", data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.id, set: { data, updatedAt: new Date() } });
    return Response.json({ groups });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Gruplar kaydedilemedi." }, { status: 400 });
  }
}
