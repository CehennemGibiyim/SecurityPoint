import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, leaveRequests } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const TYPES = new Set(["yillik","mazeret","rapor","ucretsiz","dogum","evlilik","olum"]);

function daysBetween(a:string,b:string){ const d=(new Date(b).getTime()-new Date(a).getTime())/86400000; return Math.max(1,Math.round(d)+1); }

export async function GET(req: Request) {
  await ensureSeed();
  // seed örnekler
  const existing = await db.select({id:leaveRequests.id}).from(leaveRequests).limit(1);
  if (!existing.length) {
    const emps = await db.select().from(employees).limit(12);
    if (emps.length>=6) {
      const today = new Date();
      const iso=(d:Date)=>d.toISOString().slice(0,10);
      const add=(n:number)=>{const d=new Date(today); d.setDate(d.getDate()+n); return iso(d);};
      await db.insert(leaveRequests).values([
        { employeeId: emps[0].id, type:"yillik", startDate:add(7), endDate:add(11), days:5, reason:"Yıllık izin - aile tatili", status:"approved", approvedBy:"İK Müdürü" },
        { employeeId: emps[1].id, type:"rapor", startDate:add(-2), endDate:add(0), days:3, reason:"Sağlık raporu (3 gün)", status:"approved", approvedBy:"Sistem" },
        { employeeId: emps[2].id, type:"mazeret", startDate:add(2), endDate:add(2), days:1, reason:"Resmi işlem", status:"pending" },
        { employeeId: emps[3].id, type:"yillik", startDate:add(14), endDate:add(20), days:7, reason:"Yıllık izin", status:"pending" },
        { employeeId: emps[4].id, type:"evlilik", startDate:add(-10), endDate:add(-8), days:3, reason:"Evlilik izni", status:"approved", approvedBy:"İK Müdürü" },
        { employeeId: emps[5].id, type:"ucretsiz", startDate:add(3), endDate:add(4), days:2, reason:"Kişisel", status:"rejected", approvedBy:"Vardiya Amiri" },
      ]).catch(()=>{});
    }
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const rows = await db.select({ leave: leaveRequests, employee: employees })
    .from(leaveRequests).leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .orderBy(desc(leaveRequests.createdAt));
  const items = rows
    .filter(r=>!status || r.leave.status===status)
    .map(r=>({ ...r.leave, employeeName: r.employee?`${r.employee.firstName} ${r.employee.lastName}`:"-", employeeNo:r.employee?.employeeNo, quota:r.employee?.annualLeaveQuota ?? 14 }));

  // bakiye özeti
  const approved = items.filter(i=>i.status==="approved" && i.type==="yillik");
  const usedMap = new Map<number,number>();
  approved.forEach(i=>usedMap.set(i.employeeId,(usedMap.get(i.employeeId)??0)+i.days));

  return Response.json({ items, balances: [...usedMap.entries()].map(([employeeId,used])=>({employeeId, used, remaining: Math.max(0,14-used)})) });
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {employeeId?:number; type?:string; startDate?:string; endDate?:string; reason?:string};
  if (!b.employeeId || !b.startDate || !b.endDate) return Response.json({error:"Personel ve tarihler zorunlu."},{status:400});
  const type = b.type && TYPES.has(b.type) ? b.type : "yillik";
  const [created] = await db.insert(leaveRequests).values({
    employeeId: Number(b.employeeId), type, startDate:b.startDate, endDate:b.endDate,
    days: daysBetween(b.startDate,b.endDate), reason: b.reason?.trim()||null, status:"pending"
  }).returning();
  return Response.json({item:created},{status:201});
}
