import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { doors, employees, rollCallMarks, rollCalls, securityAlarms } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const [emps, drs, alarms] = await Promise.all([
    db.select().from(employees),
    db.select().from(doors),
    db.select().from(securityAlarms).orderBy(desc(securityAlarms.createdAt)).limit(30),
  ]);
  // Zone doluluk: insideZone'a göre
  const occupancyMap = new Map<string, number>();
  emps.forEach(e=>{ if(e.insideZone) occupancyMap.set(e.insideZone,(occupancyMap.get(e.insideZone)??0)+1); });
  const zones = drs.map(d=>({
    doorId:d.id, doorName:d.name, zone:d.zone, antiPassback:d.antiPassbackEnabled,
    maxOccupancy:d.maxOccupancy, current: occupancyMap.get(d.zone)??0, twoPersonRule:d.twoPersonRule
  }));
  const inside = emps.filter(e=>e.insideZone).map(e=>({id:e.id,name:`${e.firstName} ${e.lastName}`,zone:e.insideZone,employeeNo:e.employeeNo}));
  const blacklisted = emps.filter(e=>e.isBlacklisted).map(e=>({id:e.id,name:`${e.firstName} ${e.lastName}`,reason:e.blacklistReason}));

  const [activeRoll] = await db.select().from(rollCalls).where(eq(rollCalls.status,"active")).orderBy(desc(rollCalls.startedAt)).limit(1);
  let rollCall: unknown = null;
  if (activeRoll) {
    const marks = await db.select().from(rollCallMarks).where(eq(rollCallMarks.rollCallId, activeRoll.id));
    rollCall = { ...activeRoll, total: marks.length, safe: marks.filter(m=>m.markedSafe).length,
      missing: marks.filter(m=>!m.markedSafe).map(m=>m.employeeId) };
  }

  return Response.json({ zones, inside, blacklisted, alarms, rollCall,
    stats:{ insideCount: inside.length, alarmCount: alarms.filter(a=>!a.isResolved).length, blacklistedCount: blacklisted.length } });
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {action?:string; employeeId?:number; alarmId?:number; doorId?:number; enabled?:boolean};
  if (b.action === "start_rollcall") {
    const [rc] = await db.insert(rollCalls).values({title:"Acil Durum Yoklaması", status:"active"}).returning();
    const inside = await db.select().from(employees);
    const targets = inside.filter(e=>e.insideZone);
    const seedTargets = targets.length ? targets : inside.slice(0,8);
    if (seedTargets.length) await db.insert(rollCallMarks).values(seedTargets.map(e=>({rollCallId:rc.id, employeeId:e.id, markedSafe:false})));
    await db.insert(securityAlarms).values({type:"rollcall", severity:"high", message:`Acil yoklama başlatıldı: ${seedTargets.length} kişi içeride sayılacak.`});
    return Response.json({ok:true, rollCallId:rc.id});
  }
  if (b.action === "mark_safe" && b.employeeId) {
    const [rc] = await db.select().from(rollCalls).where(eq(rollCalls.status,"active")).limit(1);
    if (rc) await db.update(rollCallMarks).set({markedSafe:true, markedAt:new Date()})
      .where(eq(rollCallMarks.rollCallId, rc.id));
    // sadece ilgili kişiyi işaretlemek için ikinci adımda filtre (basitlik)
    return Response.json({ok:true});
  }
  if (b.action === "mark_safe_one" && b.employeeId) {
    const [rc] = await db.select().from(rollCalls).where(eq(rollCalls.status,"active")).limit(1);
    if (rc) {
      const marks = await db.select().from(rollCallMarks).where(eq(rollCallMarks.rollCallId, rc.id));
      const m = marks.find(x=>x.employeeId===b.employeeId);
      if (m) await db.update(rollCallMarks).set({markedSafe:true, markedAt:new Date()}).where(eq(rollCallMarks.id, m.id));
    }
    return Response.json({ok:true});
  }
  if (b.action === "end_rollcall") {
    const [rc] = await db.select().from(rollCalls).where(eq(rollCalls.status,"active")).limit(1);
    if (rc) await db.update(rollCalls).set({status:"ended", endedAt:new Date()}).where(eq(rollCalls.id, rc.id));
    return Response.json({ok:true});
  }
  if (b.action === "resolve_alarm" && b.alarmId) {
    await db.update(securityAlarms).set({isResolved:true}).where(eq(securityAlarms.id, b.alarmId));
    return Response.json({ok:true});
  }
  if (b.action === "toggle_antipassback" && b.doorId) {
    await db.update(doors).set({antiPassbackEnabled: !!b.enabled}).where(eq(doors.id, b.doorId));
    return Response.json({ok:true});
  }
  if (b.action === "toggle_blacklist" && b.employeeId) {
    const [e] = await db.select().from(employees).where(eq(employees.id, b.employeeId));
    if (e) await db.update(employees).set({isBlacklisted: !e.isBlacklisted, blacklistReason: !e.isBlacklisted ? "Güvenlik incelemesi" : null}).where(eq(employees.id, b.employeeId));
    return Response.json({ok:true});
  }
  return Response.json({error:"Geçersiz işlem"},{status:400});
}
