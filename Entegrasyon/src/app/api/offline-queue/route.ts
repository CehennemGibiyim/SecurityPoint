import { eq } from "drizzle-orm";
import { db } from "@/db";
import { offlineQueue } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await db.select().from(offlineQueue).orderBy(offlineQueue.id);
  return Response.json({ items, pending: items.filter(i=>!i.synced).length });
}
export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {doorId?:number; payload?:unknown; action?:string; id?:number};
  if (b.action === "sync_all") {
    const pending = await db.select().from(offlineQueue).where(eq(offlineQueue.synced,false));
    for (const p of pending) await db.update(offlineQueue).set({synced:true}).where(eq(offlineQueue.id,p.id));
    return Response.json({ok:true, synced:pending.length});
  }
  const [created] = await db.insert(offlineQueue).values({doorId:b.doorId??null, payload:b.payload??{}, synced:false}).returning();
  return Response.json({ok:true,item:created});
}
