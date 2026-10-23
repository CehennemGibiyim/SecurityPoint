import { eq } from "drizzle-orm";
import { db } from "@/db";
import { holidays } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const SEED_2026 = [
  {date:"2026-01-01",name:"Yılbaşı"},{date:"2026-03-20",name:"Ramazan Bayramı 1. Gün"},
  {date:"2026-03-21",name:"Ramazan Bayramı 2. Gün"},{date:"2026-03-22",name:"Ramazan Bayramı 3. Gün"},
  {date:"2026-04-23",name:"Ulusal Egemenlik ve Çocuk Bayramı"},{date:"2026-05-01",name:"Emek ve Dayanışma Günü"},
  {date:"2026-05-19",name:"Atatürk'ü Anma, Gençlik ve Spor Bayramı"},
  {date:"2026-05-27",name:"Kurban Bayramı 1. Gün"},{date:"2026-05-28",name:"Kurban Bayramı 2. Gün"},
  {date:"2026-05-29",name:"Kurban Bayramı 3. Gün"},{date:"2026-05-30",name:"Kurban Bayramı 4. Gün"},
  {date:"2026-07-15",name:"Demokrasi ve Milli Birlik Günü"},{date:"2026-08-30",name:"Zafer Bayramı"},
  {date:"2026-10-29",name:"Cumhuriyet Bayramı"},
];

export async function GET() {
  await ensureSeed();
  const ex = await db.select({id:holidays.id}).from(holidays).limit(1);
  if (!ex.length) await db.insert(holidays).values(SEED_2026).catch(()=>{});
  const items = await db.select().from(holidays).orderBy(holidays.date);
  return Response.json({ items });
}
export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {date?:string; name?:string; isHalfDay?:boolean};
  if (!b.date || !b.name?.trim()) return Response.json({error:"Tarih ve ad zorunlu."},{status:400});
  const [created] = await db.insert(holidays).values({date:b.date, name:b.name.trim(), isHalfDay:!!b.isHalfDay}).returning();
  return Response.json({item:created},{status:201});
}
export async function DELETE(req: Request) {
  await ensureSeed();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return Response.json({error:"id gerekli"},{status:400});
  await db.delete(holidays).where(eq(holidays.id, id));
  return Response.json({ok:true});
}
