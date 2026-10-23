import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, employees, holidays, timesheetApprovals } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeed();
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || new Date().toISOString().slice(0,7);
  const format = url.searchParams.get("format");
  const [y,m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const end = `${period}-${new Date(y,m,0).getDate()}`;

  const [emps, records, hols, approvals] = await Promise.all([
    db.select().from(employees),
    db.select().from(attendanceRecords).where(and(gte(attendanceRecords.workDate,start), lte(attendanceRecords.workDate,end))),
    db.select().from(holidays),
    db.select().from(timesheetApprovals).where(eq(timesheetApprovals.period, period)),
  ]);
  const holSet = new Set(hols.map(h=>h.date));
  const apprMap = new Map(approvals.map(a=>[a.employeeId,a]));

  const items = emps.map(e=>{
    const recs = records.filter(r=>r.employeeId===e.id);
    const present = recs.filter(r=>r.clockIn).length;
    const workMin = recs.reduce((a,r)=>a+r.workMinutes,0);
    const overMin = recs.reduce((a,r)=>a+r.overtimeMinutes,0);
    const lateMin = recs.reduce((a,r)=>a+r.lateMinutes,0);
    const breakMin = recs.reduce((a,r)=>a+r.breakMinutes,0);
    const holidayWork = recs.filter(r=>holSet.has(r.workDate)&&r.clockIn).length;
    const hourly = 350; // demo saat ücreti TL
    const normalPay = Math.round(workMin/60*hourly);
    const overtimePay = Math.round(overMin/60*hourly*1.5);
    const a = apprMap.get(e.id);
    return { employeeId:e.id, employeeNo:e.employeeNo, name:`${e.firstName} ${e.lastName}`,
      presentDays:present, absentDays: Math.max(0, 22-present), workMinutes:workMin, overtimeMinutes:overMin,
      lateMinutes:lateMin, breakMinutes:breakMin, holidayWorkDays:holidayWork,
      normalPay, overtimePay, grossPay: normalPay+overtimePay+(holidayWork*hourly*8),
      status: a?.status ?? "draft", approvalId: a?.id ?? null };
  });

  if (format === "csv") {
    const header = "Sicil,Ad Soyad,Gelinen Gün,Devamsız,Çalışma (dk),Fazla Mesai (dk),Geç (dk),Brüt Hakediş (TL),Durum\n";
    const csv = header + items.map(i=>[i.employeeNo,`"${i.name}"`,i.presentDays,i.absentDays,i.workMinutes,i.overtimeMinutes,i.lateMinutes,i.grossPay,i.status].join(",")).join("\n");
    return new Response("\uFEFF"+csv, { headers: { "Content-Type":"text/csv; charset=utf-8", "Content-Disposition":`attachment; filename="puantaj-${period}.csv"` }});
  }
  return Response.json({ period, items, totals:{ gross: items.reduce((a,i)=>a+i.grossPay,0), overtimeMinutes: items.reduce((a,i)=>a+i.overtimeMinutes,0) } });
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {period?:string; action?:string; employeeId?:number};
  const period = b.period || new Date().toISOString().slice(0,7);
  if (b.action === "approve_all") {
    const emps = await db.select().from(employees);
    for (const e of emps) {
      const [ex] = await db.select().from(timesheetApprovals).where(and(eq(timesheetApprovals.employeeId,e.id), eq(timesheetApprovals.period,period)));
      if (ex) await db.update(timesheetApprovals).set({status:"approved", approvedBy:"İK / Bordro"}).where(eq(timesheetApprovals.id, ex.id));
      else await db.insert(timesheetApprovals).values({employeeId:e.id, period, status:"approved", approvedBy:"İK / Bordro"});
    }
    return Response.json({ok:true});
  }
  if (b.action === "lock" && b.employeeId) {
    const [ex] = await db.select().from(timesheetApprovals).where(and(eq(timesheetApprovals.employeeId,b.employeeId), eq(timesheetApprovals.period,period)));
    if (ex) await db.update(timesheetApprovals).set({status:"locked"}).where(eq(timesheetApprovals.id, ex.id));
    else await db.insert(timesheetApprovals).values({employeeId:b.employeeId, period, status:"locked", approvedBy:"İK / Bordro"});
    return Response.json({ok:true});
  }
  return Response.json({error:"Geçersiz"},{status:400});
}
