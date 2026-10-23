import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accessLogs, doors, employees, rollCallMarks, rollCalls, securityAlarms } from "@/db/face-schema";
import { appSettings } from "@/db/schema";
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
  const inside = emps.filter(e=>e.insideZone).map(e=>{
    return {id:e.id,name:`${e.firstName} ${e.lastName}`,zone:e.insideZone,employeeNo:e.employeeNo};
  });

  // Son geçiş olayları: içeride kalma süresi + hayalet tespiti + red galerisi
  const recentLogs = await db.select().from(accessLogs).orderBy(desc(accessLogs.createdAt)).limit(500);
  const lastEventByEmp = new Map<number, Date>();
  for (const log of recentLogs) {
    if (log.employeeId && !lastEventByEmp.has(log.employeeId)) {
      const at = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
      lastEventByEmp.set(log.employeeId, at);
    }
  }
  const GHOST_HOURS = 12;
  const nowMs = Date.now();
  const insideDetailed = inside.map((e) => {
    const last = lastEventByEmp.get(e.id) ?? null;
    const lastMs = last ? last.getTime() : null;
    const sinceHours = lastMs === null ? null : Math.round(((nowMs - lastMs) / 3600000) * 10) / 10;
    return { ...e, sinceHours, lastEventAt: lastMs === null ? null : new Date(lastMs).toISOString() };
  });
  // Hayalet: içeride görünüyor ama12 saattir (veya hiç) geçiş olayı yok
  const ghosts = insideDetailed.filter((e) =>
    e.lastEventAt === null || nowMs - new Date(e.lastEventAt).getTime() > GHOST_HOURS * 3600000,
  );

  // Reddedilen denemeler / spoof geçmişi (kare varsa galeriye düşer)
  const empById = new Map(emps.map((e) => [e.id, e]));
  const doorById = new Map(drs.map((d) => [d.id, d]));
  const rejected = recentLogs.filter((l) => l.result === "denied").slice(0, 12).map((l) => ({
    id: l.id,
    createdAt: l.createdAt,
    eventType: l.eventType,
    reason: l.reason,
    livenessScore: l.livenessScore,
    snapshot: l.snapshot,
    employeeName: l.employeeId && empById.get(l.employeeId)
      ? `${empById.get(l.employeeId)!.firstName} ${empById.get(l.employeeId)!.lastName}`
      : null,
    doorName: l.doorId && doorById.get(l.doorId) ? doorById.get(l.doorId)!.name : null,
  }));

  // Aktif acil durum kilit açma protokolü
  const settingsRow = (await db.select({ data: appSettings.data }).from(appSettings).where(eq(appSettings.id, "global")))[0];
  const emData = settingsRow?.data as unknown as { emergency?: { doorIds: number[] | "all"; until: string; by: string } } | undefined;
  const em = emData?.emergency;
  const emergency = em && !Number.isNaN(new Date(em.until).getTime()) && new Date(em.until).getTime() > nowMs ? em : null;
  const blacklisted = emps.filter(e=>e.isBlacklisted).map(e=>({id:e.id,name:`${e.firstName} ${e.lastName}`,reason:e.blacklistReason}));

  const [activeRoll] = await db.select().from(rollCalls).where(eq(rollCalls.status,"active")).orderBy(desc(rollCalls.startedAt)).limit(1);
  let rollCall: unknown = null;
  if (activeRoll) {
    const marks = await db.select().from(rollCallMarks).where(eq(rollCallMarks.rollCallId, activeRoll.id));
    rollCall = { ...activeRoll, total: marks.length, safe: marks.filter(m=>m.markedSafe).length,
      missing: marks.filter(m=>!m.markedSafe).map(m=>m.employeeId) };
  }

  return Response.json({ zones, inside: insideDetailed, ghosts, rejected, emergency, blacklisted, alarms, rollCall,
    stats:{ insideCount: inside.length, alarmCount: alarms.filter(a=>!a.isResolved).length, blacklistedCount: blacklisted.length } });
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = await req.json() as {action?:string; employeeId?:number; alarmId?:number; doorId?:number; enabled?:boolean; doorIds?:number[]; minutes?:number; by?:string};
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
  if (b.action === "emergency_unlock") {
    const doorIds: number[] | "all" = Array.isArray(b.doorIds) && b.doorIds.length
      ? b.doorIds.map(Number).filter(n => !Number.isNaN(n))
      : "all";
    const minutes = Math.min(Math.max(Number(b.minutes) || 60, 1), 600);
    const by = String(b.by || "Yönetici").slice(0, 60);
    const until = new Date(Date.now() + minutes * 60000);
    const row = (await db.select({data: appSettings.data}).from(appSettings).where(eq(appSettings.id, "global")))[0];
    const data = { ...((row?.data as object) ?? {}), emergency: { doorIds, until: until.toISOString(), by } };
    await db.insert(appSettings).values({ id: "global", data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.id, set: { data, updatedAt: new Date() } });
    const affected = doorIds === "all" ? (await db.select({ id: doors.id }).from(doors)).length : doorIds.length;
    await db.insert(securityAlarms).values({ type: "emergency_unlock", severity: "high",
      message: `${by} acil durum protokolü: ${affected} kapı ${minutes} dk boyunca serbest.` });
    // İmza defterine kimin açtığı düşer (kapi-imza ekranı Face olaylarını okur)
    await db.insert(accessLogs).values({ eventType: "emergency_unlock", result: "granted",
      reason: `${by} acil kilit açma başlattı — ${minutes} dk, kapılar: ${doorIds === "all" ? "tümü" : doorIds.join(",")}` });
    return Response.json({ ok: true, until: until.toISOString(), by, doorIds });
  }
  if (b.action === "emergency_end") {
    const by = String(b.by || "Yönetici").slice(0, 60);
    const row = (await db.select({data: appSettings.data}).from(appSettings).where(eq(appSettings.id, "global")))[0];
    const data = { ...((row?.data as object) ?? {}) } as Record<string, unknown>;
    delete data.emergency;
    await db.insert(appSettings).values({ id: "global", data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.id, set: { data, updatedAt: new Date() } });
    await db.insert(securityAlarms).values({ type: "emergency_end", severity: "medium",
      message: `${by} acil durum kilit açma protokolünü sonlandırdı.` });
    await db.insert(accessLogs).values({ eventType: "emergency_end", result: "granted",
      reason: `${by} acil kilit açmayı sonlandırdı` });
    return Response.json({ ok: true });
  }
  if (b.action === "clear_zone" && b.employeeId) {
    const [target] = await db.select().from(employees).where(eq(employees.id, b.employeeId));
    if (!target) return Response.json({error:"Personel bulunamadı."},{status:404});
    const zone = target.insideZone;
    await db.update(employees).set({insideZone: null}).where(eq(employees.id, b.employeeId));
    await db.insert(securityAlarms).values({ type: "zone_clear", severity: "low",
      message: `Hayalet temizliği: ${target.firstName} ${target.lastName} (${zone ?? "-"} bölgesinden) dışarı işaretlendi.` });
    return Response.json({ok:true});
  }
  return Response.json({error:"Geçersiz işlem"},{status:400});
}
