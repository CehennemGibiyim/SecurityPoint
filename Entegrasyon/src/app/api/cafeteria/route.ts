import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cafeteriaLogs, employees } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const today = todayISO();
  const rows = await db.select({log:cafeteriaLogs, emp:employees}).from(cafeteriaLogs)
    .leftJoin(employees, eq(cafeteriaLogs.employeeId, employees.id))
    .where(eq(cafeteriaLogs.workDate, today)).orderBy(desc(cafeteriaLogs.createdAt));
  return Response.json({ date: today, items: rows.map(r=>({...r.log, name: r.emp?`${r.emp.firstName} ${r.emp.lastName}`:"-"})),
    counts:{ kahvalti: rows.filter(r=>r.log.mealType==="kahvalti").length, ogle: rows.filter(r=>r.log.mealType==="ogle").length, aksam: rows.filter(r=>r.log.mealType==="aksam").length } });
}
export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {employeeId?:number; mealType?:string};
  if (!b.employeeId) return Response.json({error:"Personel gerekli"},{status:400});
  const meal = ["kahvalti","ogle","aksam"].includes(b.mealType||"") ? b.mealType! : "ogle";
  const today = todayISO();
  const dup = await db.select().from(cafeteriaLogs).where(and(eq(cafeteriaLogs.employeeId,b.employeeId), eq(cafeteriaLogs.workDate,today), eq(cafeteriaLogs.mealType,meal)));
  if (dup.length) return Response.json({error:"BUGÜN BU ÖĞÜN HAKKI ZATEN KULLANILDI — mükerrer yemek engellendi."},{status:409});
  const [created] = await db.insert(cafeteriaLogs).values({employeeId:b.employeeId, mealType:meal, workDate:today}).returning();
  return Response.json({ok:true,item:created});
}
