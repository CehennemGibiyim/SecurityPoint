#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * Personel26 — GitHub Pages sürümü duman testi (tarayıcısız)
 * ════════════════════════════════════════════════════════════════
 *
 * Panelin sunucusuz (GitHub Pages) arka ucunu Node.js üzerinde çalıştırır:
 *   • tarayıcı içi PostgreSQL (PGlite) + Drizzle şeması kurulur,
 *   • örnek veriler yüklenir,
 *   • panelin gerçek API uçları `fetch("/api/...")` çağrılarıyla denenir.
 *
 * Kullanım:
 *   npm run pages:build && npm run pages:test
 *
 * Not: Tarayıcıya özel parçalar (fetch kesici, arayüz kapısı) bu testte
 * taklit edilir; veritabanı/API davranışı birebir aynı koddur.
 */
import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { bundleBridge } from "./lib/bridge-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workDir = path.join(root, ".pages-build", "smoke");
const pgliteDist = path.join(root, "node_modules", "@electric-sql", "pglite", "dist");

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`   ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`   ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ───────────────────────────────────────────────
// 1) Test paketini derle (aynı kaynak kod, Node hedefi)
// ───────────────────────────────────────────────
console.log("\n1) Tarayıcı arka ucu derleniyor (Node hedefi)…");
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

const ddlDir = path.join(workDir, "ddl");
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "drizzle-kit", "bin.cjs"),
    "generate",
    "--dialect=postgresql",
    `--schema=${path.join(root, "src", "db", "schema.ts")}`,
    `--out=${ddlDir}`,
  ],
  { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
);
const { readdir } = await import("node:fs/promises");
const ddlFiles = (await readdir(ddlDir)).filter((f) => f.endsWith(".sql")).sort();
const ddl = await (await import("node:fs/promises")).readFile(
  path.join(ddlDir, ddlFiles[ddlFiles.length - 1]),
  "utf8",
);

await bundleBridge({ root, ddl, outfile: path.join(workDir, "app.js"), platform: "node" });
// Node'un paketi ESM olarak çözmesi için
await (await import("node:fs/promises")).writeFile(path.join(workDir, "package.json"), '{"type":"module"}', "utf8");
for (const asset of ["pglite.wasm", "initdb.wasm", "pglite.data"]) {
  await cp(path.join(pgliteDist, asset), path.join(workDir, asset));
}

// ───────────────────────────────────────────────
// 2) Tarayıcı ortamı taklidi + panel arka ucunu başlat
// ───────────────────────────────────────────────
console.log("\n2) Tarayıcı ortamı taklit ediliyor, veritabanı başlatılıyor…");
const origin = "http://127.0.0.1:4173";
const storage = new Map();
const statusLog = [];

globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
};
// Tarayıcı `location` nesnesi: URL tabanlı taklit (pathname, protocol vb. gerekli)
globalThis.location = Object.assign(new URL(`${origin}/`), {
  reload: () => console.log("   (sayfa yenileme çağrısı yapıldı)"),
});
globalThis.__p26Status = (message) => statusLog.push(message);

const ready = new Promise((resolve, reject) => {
  globalThis.__p26Resolve = resolve;
  globalThis.__p26Reject = reject;
});
globalThis.__P26_READY = ready;
globalThis.fetch = globalThis.fetch; // Node'un kendi fetch'i köprü tarafından sarılır

const t0 = Date.now();
await import(pathToFileURL(path.join(workDir, "app.js")).href);
await ready;
const bootMs = Date.now() - t0;
console.log(`   ✓ Veritabanı ${bootMs} ms'de hazır${statusLog.length ? ` (${statusLog.join(" → ")})` : ""}`);
check("Köprü global API'si kuruldu", Boolean(globalThis.__p26?.api));

const api = async (pathName, init) => globalThis.window.fetch(`${origin}${pathName}`, init);
const json = async (pathName, init) => {
  const res = await api(pathName, init);
  const data = await res.json().catch(() => ({}));
  return { res, data };
};
const post = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ───────────────────────────────────────────────
// 3) Uçlar
// ───────────────────────────────────────────────
console.log("\n3) Panel uçları deneniyor…");

const { res: bootRes, data: boot } = await json("/api/bootstrap");
check("GET /api/bootstrap 200", bootRes.status === 200, `durum ${bootRes.status}`);
check("Servisler yüklendi (3)", boot.departments?.length === 3, `bulunan: ${boot.departments?.length}`);
check("Personel yüklendi (24)", (boot.personnel?.length ?? 0) >= 20, `bulunan: ${boot.personnel?.length}`);
check("Tatiller yüklendi", (boot.holidays?.length ?? 0) > 10, `bulunan: ${boot.holidays?.length}`);
check("Vardiya şablonları yüklendi", (boot.templates?.length ?? 0) >= 2, `bulunan: ${boot.templates?.length}`);

const deptId = boot.departments?.[0]?.id;
const personId = boot.personnel?.[0]?.id;
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const pad = (n) => String(n).padStart(2, "0");
const startD = `${year}-${pad(month + 1)}-01`;

const { res: tsRes, data: ts } = await json(`/api/timesheet?year=${year}&month=${month}&dept=${deptId}&personnel=${personId}`);
check("GET /api/timesheet 200", tsRes.status === 200, `durum ${tsRes.status}`);
check("Puantaj kayıtları var", (ts.entries?.length ?? 0) > 0, `kayıt: ${ts.entries?.length}`);

const { res: tsPut } = await json("/api/timesheet", { ...post({ personnelId: personId, entryDate: startD, shiftType: "MANUAL", hoursWorked: 7.5 }), method: "PUT" });
check("PUT /api/timesheet (hücre kaydı)", tsPut.status === 200, `durum ${tsPut.status}`);
const { data: tsAfter } = await json(`/api/timesheet?year=${year}&month=${month}&dept=${deptId}&personnel=${personId}`);
const written = tsAfter.entries?.find((e) => e.entryDate === startD);
check("Kaydedilen saat geri okundu (7.5)", Math.abs((written?.hoursWorked ?? 0) - 7.5) < 0.001, `okunan: ${written?.hoursWorked}`);
await json("/api/timesheet", { ...post({ personnelId: personId, entryDate: startD }), method: "DELETE" });

const { res: rosterRes, data: roster } = await json(`/api/roster?dept=${deptId}&year=${year}&month=${month}&group=SAGLIK`);
check("GET /api/roster 200", rosterRes.status === 200, `durum ${rosterRes.status}`);
check("Nöbet çizelgesi verisi döndü", Array.isArray(roster.columns) || Array.isArray(roster.assignments) || Array.isArray(roster.schedules), JSON.stringify(Object.keys(roster)).slice(0, 120));

const { res: persRes, data: pers } = await json("/api/personnel");
check("GET /api/personnel 200", persRes.status === 200, `durum ${persRes.status}`);
check("Personel listesi dolu", (pers.personnel?.length ?? 0) >= 20);

const newPerson = {
  name: "TEST PERSONEL",
  tcNo: "10000009999",
  title: "Hemşire",
  personnelType: "MEMUR",
  departmentIds: [deptId],
  departmentId: deptId,
};
const { res: createRes, data: created } = await json("/api/personnel", post(newPerson));
check("POST /api/personnel (yeni personel)", createRes.status === 200, JSON.stringify(created).slice(0, 160));
const createdId = created.personnel?.id;
check("Yeni personel kimliği döndü", Boolean(createdId));

if (createdId) {
  const { res: patchRes } = await json("/api/personnel", { ...post({ id: createdId, title: "Ebe" }), method: "PATCH" });
  check("PATCH /api/personnel (güncelleme)", patchRes.status === 200, `durum ${patchRes.status}`);
  const { res: delRes } = await json("/api/personnel", { ...post({ id: createdId, hard: true }), method: "DELETE" });
  check("DELETE /api/personnel (silme)", delRes.status === 200, `durum ${delRes.status}`);
}

// Teknisyen grubu ve elle eklenen özel nöbet grubu
for (const [grp, label] of [["TEKNISYEN", "Teknisyen"], ["OZEL:Anestezi Teknikerleri", "Özel grup"]]) {
  const { res: gRes, data: gCreated } = await json("/api/personnel", post({ name: "GRUP TESTİ " + label.toUpperCase(), title: "Teknisyen", personnelType: "ISCI", staffGroup: grp, departmentIds: [deptId], departmentId: deptId }));
  const gId = gCreated.personnel?.id;
  check(`${label}: personel oluşturuldu, grup korundu`, gRes.status === 200 && gCreated.personnel?.staffGroup === grp, `durum ${gRes.status} ${gCreated.personnel?.staffGroup}`);
  const q = encodeURIComponent(grp);
  const { res: rRes, data: rData } = await json(`/api/roster?dept=${deptId}&year=${year}&month=${month}&group=${q}`);
  check(`${label}: nöbet çizelgesi açılıyor`, rRes.status === 200 && Array.isArray(rData.columns) && rData.columns.length > 0, `durum ${rRes.status} ${JSON.stringify(rData).slice(0, 100)}`);
  const xr = await api(`/api/export/nobet?dept=${deptId}&year=${year}&month=${month}&format=xlsx&group=${q}`);
  check(`${label}: nöbet Excel çıktısı`, xr.status === 200, `durum ${xr.status}`);
  if (gId) await json("/api/personnel", { ...post({ id: gId, hard: true }), method: "DELETE" });
}
const { data: badGroup } = await json("/api/personnel", post({ name: "GRUP TESTİ GEÇERSİZ", personnelType: "ISCI", staffGroup: "OZEL:x", departmentIds: [deptId], departmentId: deptId }));
check("Geçersiz (çok kısa) özel grup SAĞLIK'a düşer", badGroup.personnel?.staffGroup === "SAGLIK", String(badGroup.personnel?.staffGroup));
if (badGroup.personnel?.id) await json("/api/personnel", { ...post({ id: badGroup.personnel.id, hard: true }), method: "DELETE" });

// Özel tema, otomatik tema ve tema koruması
{
  const { data: cur } = await json("/api/settings");
  const base = cur.settings;
  const custom = { id: "custom:smoke-1", name: "Duman Testi", bg: "#101820", panel: "#1b2733", sidebar: "#14202b", accent: "#ffb703", text: "#f1f5f9", muted: "#94a3b8" };
  const bad = { id: "custom:bad-1", name: "Bozuk", bg: "kırmızı", panel: "#1b2733", sidebar: "#14202b", accent: "#ffb703", text: "#f1f5f9", muted: "#94a3b8" };
  const put = async body => json("/api/settings", { ...post(body), method: "PUT" });
  const { res: r1, data: d1 } = await put({ ...base, theme: custom.id, themeAuto: false, customThemes: [custom, bad] });
  check("Özel tema kaydedilir ve seçilir", r1.status === 200 && d1.settings.theme === custom.id && d1.settings.customThemes.length === 1, JSON.stringify(d1).slice(0, 140));
  check("Bozuk özel tema (geçersiz renk) ayıklanır", !d1.settings?.customThemes?.some(t => t.id === "custom:bad-1"));
  check("Özel tema kategorisi renkten hesaplanır (koyu)", d1.settings?.customThemes?.[0]?.category === "dark");
  const { data: d2 } = await put({ ...d1.settings, customThemes: [] });
  check("Silinen temayı seçili bırakan kayıt ana temaya döner", d2.settings?.theme === "original", String(d2.settings?.theme));
  const { data: d3 } = await put({ ...base, theme: "olmayan-tema", customThemes: [] });
  check("Bilinmeyen tema kaydı reddetmez, ana temaya döner", d3.settings?.theme === "original", JSON.stringify(d3).slice(0, 100));
  const noAuto = { ...base }; delete noAuto.themeAuto;
  const { data: d4 } = await put({ ...noAuto, theme: "ocean", customThemes: [] });
  check("Eski kayıtlarda themeAuto yoksa kapalı sayılır (tema kendiliğinden değişmez)", d4.settings?.themeAuto === false && d4.settings?.theme === "ocean", JSON.stringify(d4.settings).slice(0, 120));
  const { data: d5 } = await put({ ...base, theme: "original", themeAuto: true, customThemes: [] });
  check("Otomatik tema (sistemi izle) kaydedilir", d5.settings?.themeAuto === true);
  await put({ ...base, customThemes: [] });
}

// Boş özel gruplar veritabanında saklanır ve yedeğe girer
const { res: cgPut, data: cgData } = await json("/api/custom-groups", { ...post({ groups: ["OZEL:Güvenlik", "OZEL:x", "SAGLIK", "OZEL:Güvenlik"] }), method: "PUT" });
check("Özel gruplar kaydedilir (geçersiz/yinelenenler ayıklanır)", cgPut.status === 200 && JSON.stringify(cgData.groups) === JSON.stringify(["OZEL:Güvenlik"]), JSON.stringify(cgData));
const { data: cgGet } = await json("/api/custom-groups");
check("Özel gruplar geri okunur", JSON.stringify(cgGet.groups) === JSON.stringify(["OZEL:Güvenlik"]), JSON.stringify(cgGet));
const { res: setRes, data: setData } = await json("/api/settings");
const { res: setPut } = await json("/api/settings", { ...post({ ...setData.settings, customGroups: [] }), method: "PUT" });
const { data: cgAfter } = await json("/api/custom-groups");
check("Ayar kaydı özel grupları silmez", setPut.status === 200 && cgAfter.groups?.length === 1, `ayar durumu ${setPut.status} ${JSON.stringify(cgAfter)}`);
const { res: bkRes, data: bk } = await json("/api/backup", post({}));
check("Yedek alındı (boş özel grup dahil)", bkRes.status === 200 && Boolean(bk.id), JSON.stringify(bk).slice(0, 100));
const { data: bkData } = await json(`/api/backup/${bk.id}`);
const settingsRow = (bkData.app_settings ?? []).find(r => r.id === "global");
check("Yedekte özel gruplar var", JSON.stringify(settingsRow?.data?.customGroups) === JSON.stringify(["OZEL:Güvenlik"]), JSON.stringify(settingsRow?.data?.customGroups));
const { res: pvRes } = await json("/api/database", post({ action: "preview", data: bkData }));
check("Yedek geri yükleme önizlemesi geçerli", pvRes.status === 200, `durum ${pvRes.status}`);
await json("/api/custom-groups", { ...post({ groups: [] }), method: "PUT" });

const { res: leavesRes, data: leaves } = await json(`/api/leaves?personnel=${personId}`);
check("GET /api/leaves 200", leavesRes.status === 200, `durum ${leavesRes.status}`);
check("İzin kayıtları listelendi", Array.isArray(leaves.leaves));

const { res: leaveCreate, data: leaveCreated } = await json(
  "/api/leaves",
  post({ personnelId: personId, leaveType: "YILLIK", startDate: startD, endDate: `${year}-${pad(month + 1)}-02`, reason: "Duman testi" }),
);
check("POST /api/leaves (izin talebi)", leaveCreate.status === 200, JSON.stringify(leaveCreated).slice(0, 140));
if (leaveCreated.leave?.id) {
  // 3 aşamalı onay akışı: Hemşire → Müdür → Başhekim
  let stageOk = true;
  for (const stage of ["HEMSIRE", "MUDUR", "BASHEKIM"]) {
    const { res, data } = await json("/api/leaves", { ...post({ id: leaveCreated.leave.id, action: "approve-stage", by: "Duman Testi" }), method: "PATCH" });
    if (res.status !== 200) stageOk = false;
    void data;
    void stage;
  }
  const { data: afterApprove } = await json(`/api/leaves?personnel=${personId}`);
  const approved = afterApprove.leaves?.find((l) => l.id === leaveCreated.leave.id);
  check("PATCH /api/leaves (3 aşamalı onay)", stageOk && approved?.status === "APPROVED", `durum: ${approved?.status}`);
  const { res: rejectRes } = await json("/api/leaves", { ...post({ id: leaveCreated.leave.id, action: "reject", by: "Duman Testi", note: "test" }), method: "PATCH" });
  check("PATCH /api/leaves (red)", rejectRes.status === 200, `durum ${rejectRes.status}`);
  await json("/api/leaves", { ...post({ id: leaveCreated.leave.id }), method: "DELETE" });
}

const { res: annRes, data: ann } = await json("/api/announcements");
check("GET /api/announcements 200", annRes.status === 200 && Array.isArray(ann.announcements), `durum ${annRes.status}`);

const { res: deptRes, data: depts } = await json("/api/departments");
check("GET /api/departments 200", deptRes.status === 200 && (depts.departments?.length ?? 0) > 0);

const { res: swapsRes } = await json("/api/swaps");
check("GET /api/swaps 200", swapsRes.status === 200, `durum ${swapsRes.status}`);

const { res: schedRes, data: scheds } = await json(`/api/schedules?dept=${deptId}&start=${startD}&end=${year}-12-31`);
check("GET /api/schedules 200", schedRes.status === 200 && Array.isArray(scheds.schedules), `durum ${schedRes.status}`);

const { res: healthRes, data: health } = await json("/api/health");
check("GET /api/health 200", healthRes.status === 200, JSON.stringify(health).slice(0, 120));

const { res: tplRes, data: tpl } = await json("/api/templates");
check("GET /api/templates 200", tplRes.status === 200 && (tpl.templates?.length ?? 0) >= 2);

const avatarRes = await api(`/api/personnel/avatar/${personId}`);
check("GET /api/personnel/avatar/[id] (fotoğraf yok → 404)", avatarRes.status === 404 || avatarRes.status === 200, `durum ${avatarRes.status}`);

const { res: lookupRes, data: lookup } = await json("/api/personel-lookup", post({ tcNo: "10000000146", surname: "ÇELİK" }));
check("POST /api/personel-lookup (personel sorgu)", lookupRes.status === 200, `durum ${lookupRes.status} ${JSON.stringify(lookup).slice(0, 120)}`);
check("Sorgu sonucu nöbet/izin verisi içeriyor", Array.isArray(lookup.schedules) || Array.isArray(lookup.entries) || Boolean(lookup.person), JSON.stringify(Object.keys(lookup)).slice(0, 140));

// Yalnızca TC ile ve yalnızca ad soyad ile sorgu
const { res: tcOnlyRes, data: tcOnly } = await json("/api/personel-lookup", post({ tcNo: "10000000146" }));
check("Personel sorgu: yalnızca TC", tcOnlyRes.status === 200 && Boolean(tcOnly.person?.name), `durum ${tcOnlyRes.status} ${JSON.stringify(tcOnly).slice(0, 100)}`);
const { res: nameOnlyRes, data: nameOnly } = await json("/api/personel-lookup", post({ fullName: "ayşe çelik" }));
check("Personel sorgu: yalnızca ad soyad (harf duyarsız)", nameOnlyRes.status === 200 && nameOnly.person?.id === tcOnly.person?.id, `durum ${nameOnlyRes.status} ${JSON.stringify(nameOnly).slice(0, 100)}`);
const { res: oneWordRes } = await json("/api/personel-lookup", post({ fullName: "Çelik" }));
check("Personel sorgu: tek sözcük reddedilir (400)", oneWordRes.status === 400, `durum ${oneWordRes.status}`);
const { res: noNameRes } = await json("/api/personel-lookup", post({ fullName: "Olmayan Kişi" }));
check("Personel sorgu: bilinmeyen ad soyad 404", noNameRes.status === 404, `durum ${noNameRes.status}`);
const { res: badTcRes } = await json("/api/personel-lookup", post({ tcNo: "123" }));
check("Personel sorgu: eksik TC reddedilir (400)", badTcRes.status === 400, `durum ${badTcRes.status}`);

// Dışa aktarmalar (Excel/CSV/JSON) — tarayıcıda indirme olarak kullanılan uçlar
const exportTargets = [
  ["/api/export/puantaj?dept=" + deptId + "&year=" + year + "&month=" + month + "&format=xlsx&group=SAGLIK", "application/vnd.openxmlformats-officedocument", "Puantaj Excel"],
  ["/api/export/puantaj?dept=" + deptId + "&year=" + year + "&month=" + month + "&format=csv&group=SAGLIK", "text/csv", "Puantaj CSV"],
  ["/api/export/personel?dept=ALL&type=ALL&status=ALL&q=", "application/vnd.openxmlformats-officedocument", "Personel Excel"],
  ["/api/export/nobet?dept=" + deptId + "&year=" + year + "&month=" + month + "&format=xlsx&group=SAGLIK", "application/vnd.openxmlformats-officedocument", "Nöbet Excel"],
  ["/api/export/izinler?dept=" + deptId + "&year=" + year + "&status=ALL", "application/vnd.openxmlformats-officedocument", "İzinler Excel"],
];
for (const [url, mime, label] of exportTargets) {
  const res = await api(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  const detail =
    res.status === 200
      ? `durum ${res.status}, ${buf.byteLength} bayt`
      : `durum ${res.status} — ${new TextDecoder().decode(buf.slice(0, 200))}`;
  check(`${label} üretildi`, res.status === 200 && buf.byteLength > 500 && (res.headers.get("content-type") ?? "").includes(mime), detail);
}

// Yedekleme
const { res: backupRes, data: backup } = await json("/api/backup", { method: "POST" });
check("POST /api/backup (yedek al)", backupRes.status === 200 && Boolean(backup.filename), JSON.stringify(backup).slice(0, 140));
const { res: backupList } = await json("/api/backup");
check("GET /api/backup (yedek listesi)", backupList.status === 200, `durum ${backupList.status}`);
if (backup.id) {
  const res = await api(`/api/backup/${backup.id}`);
  const text = await res.text();
  check("GET /api/backup/[id] (JSON yedek indirme)", res.status === 200 && text.length > 1000, `durum ${res.status}, ${text.length} bayt`);
}

// Yeni ayar, aktarım ve geri yükleme uçları PGlite'ta da aynı sözleşmeyle çalışır.
const p26Json = (data) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
const { res: settingsRes, data: p26Settings } = await json("/api/settings");
check("PGlite ayarlar ve şema sürümü", settingsRes.ok && p26Settings.status?.schemaVersion === "2026.01");
const { res: saveSettingsRes } = await json("/api/settings", { ...p26Json({ ...p26Settings.settings, institution: "PGLITE TEST KURUMU" }), method: "PUT" });
check("PGlite ayar kaydetme", saveSettingsRes.ok);
const { data: p26Boot } = await json("/api/bootstrap");
const p26Input = { rows: [["PGLİTE AKTARIM TESTİ", "55555555550"]], mapping: { name: 0, tcNo: 1 }, defaults: { personnelType: "HEMSIRE", staffGroup: "SAGLIK", departmentIds: [p26Boot.departments[0].id] }, fileName: "pglite.csv", mode: "preview" };
const { res: importPreviewRes, data: p26Preview } = await json("/api/personnel/import", p26Json(p26Input));
check("PGlite aktarım önizleme", importPreviewRes.ok && p26Preview.summary?.valid === 1);
const { res: commitRes, data: p26Commit } = await json("/api/personnel/import", p26Json({ ...p26Input, mode: "commit", confirmed: true }));
check("PGlite transaction ile personel aktarımı", commitRes.ok && p26Commit.imported === 1, JSON.stringify(p26Commit).slice(0, 160));
const { res: schemaUpdateRes } = await json("/api/database", p26Json({ action: "update", confirm: "GÜNCELLE" }));
check("PGlite veri koruyan şema güncellemesi", schemaUpdateRes.ok);
const p26SqlResponse = await api("/api/database?format=sql");
check("PGlite SQL yedeği", p26SqlResponse.ok && (await p26SqlResponse.text()).includes("COMMIT;"));
if (backup.id) {
  const { data: p26RestoreData } = await json(`/api/backup/${backup.id}`);
  const { res: filePreviewRes } = await json("/api/database", p26Json({ action: "preview", data: p26RestoreData }));
  check("PGlite dosyadan yedek doğrulama", filePreviewRes.ok);
  const { res: restoreRes } = await json("/api/database", p26Json({ action: "restore", data: p26RestoreData, confirm: "GERİ YÜKLE" }));
  check("PGlite transaction ile geri yükleme", restoreRes.ok);
}

// Bilinmeyen uç → anlaşılır 404
const { res: unknownRes, data: unknown } = await json("/api/boyle-bir-uc-yok");
check("Bilinmeyen uç 404 döndü", unknownRes.status === 404 && Boolean(unknown.error), JSON.stringify(unknown).slice(0, 120));

// Veritabanı özeti
const info = await globalThis.__p26.info();
check("Veritabanı özeti alındı", info.mode === "browser-pglite" && Number(info.personnel) >= 20, JSON.stringify(info).slice(0, 200));

// ───────────────────────────────────────────────
// 4) Sonuç
// ───────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════");
if (failures.length === 0) {
  console.log(`✅ TÜM TESTLER GEÇTİ (${passed} kontrol)`);
  process.exit(0);
}
console.log(`❌ ${failures.length} kontrol başarısız (${passed} başarılı):`);
failures.forEach((f) => console.log(`   • ${f}`));
process.exit(1);
