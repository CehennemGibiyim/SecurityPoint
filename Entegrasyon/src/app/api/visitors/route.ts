import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, visitors } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const existing = await db.select({id:visitors.id}).from(visitors).limit(1);
  if (!existing.length) {
    const emps = await db.select().from(employees).limit(5);
    const now = new Date();
    const plus=(h:number)=>new Date(now.getTime()+h*3600000);
    await db.insert(visitors).values([
      { fullName:"Kemal Arslan (Tedarikçi)", company:"Arslan Lojistik", phone:"0532 000 00 01", hostEmployeeId: emps[0]?.id ?? null, purpose:"Sevkiyat görüşmesi", qrToken: randomUUID(), validFrom: now, validTo: plus(4), status:"checked_in", checkedInAt: now, allowedDoorIds:[] },
      { fullName:"Pınar Koç (Denetçi)", company:"TSE Denetim", phone:"0533 000 00 02", hostEmployeeId: emps[1]?.id ?? null, purpose:"ISO denetimi", qrToken: randomUUID(), validFrom: now, validTo: plus(8), status:"expected", allowedDoorIds:[] },
      { fullName:"Yasaklı Test Kişisi", company:"-", purpose:"Blacklist örneği", qrToken: randomUUID(), validFrom: now, validTo: plus(2), status:"blacklisted", allowedDoorIds:[] },
    ]).catch(()=>{});
  }
  const rows = await db.select({ v: visitors, host: employees }).from(visitors)
    .leftJoin(employees, eq(visitors.hostEmployeeId, employees.id))
    .orderBy(desc(visitors.createdAt));
  return Response.json({ items: rows.map(r=>({...r.v, hostName: r.host?`${r.host.firstName} ${r.host.lastName}`:null})) });
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {fullName?:string; company?:string; phone?:string; purpose?:string; hostEmployeeId?:number|null; validHours?:number; allowedDoorIds?:number[]};
  if (!b.fullName?.trim()) return Response.json({error:"Ziyaretçi adı zorunlu."},{status:400});
  const hours = Math.min(72, Math.max(1, Number(b.validHours||4)));
  const now = new Date();
  const [created] = await db.insert(visitors).values({
    fullName: b.fullName.trim(), company: b.company?.trim()||null, phone: b.phone?.trim()||null,
    purpose: b.purpose?.trim()||null, hostEmployeeId: b.hostEmployeeId??null,
    qrToken: randomUUID(), validFrom: now, validTo: new Date(now.getTime()+hours*3600000),
    status:"expected", allowedDoorIds: b.allowedDoorIds??[]
  }).returning();
  return Response.json({item:created},{status:201});
}
