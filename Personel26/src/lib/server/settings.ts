import { db } from "@/db";
import { appSettings, activityLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
export async function getSettings(): Promise<AppSettings> {
  const row = (await db.select().from(appSettings).where(eq(appSettings.id, "global")))[0];
  return { ...DEFAULT_SETTINGS, ...row?.data } as AppSettings;
}
export async function logActivity(action: string, description: string) {
  await db.insert(activityLogs).values({ action, description });
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).host;
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  if (origin && new URL(origin).host !== expected && new URL(origin).host !== forwarded) throw new Error("Bu kaynaktan işlem yapma izni yok.");
}
