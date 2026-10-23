"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, PageHeader, inputClass } from "@/components/ui";
import { jsonFetch } from "@/lib/api-client";
import { formatMinutes, formatTimeTr, todayISO } from "@/lib/time";
import type { AccessAction, AccessResponse, DoorPublic, EmployeePublic } from "@/lib/types";

type Row = {
  id?: number;
  employeeId: number;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  workMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  employeeName: string;
  employeeNo: string | null;
  photoUrl: string | null;
  departmentName: string | null;
  notes: string | null;
};

export default function ImzaPage() {
  const [date, setDate] = useState(todayISO());
  const [items, setItems] = useState<Row[]>([]);
  const [people, setPeople] = useState<EmployeePublic[]>([]);
  const [doors, setDoors] = useState<DoorPublic[]>([]);
  const [doorId, setDoorId] = useState<number | "">("");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [att, door, emp] = await Promise.all([
      jsonFetch<{ items: Row[] }>(`/api/attendance?from=${date}&to=${date}`),
      jsonFetch<{ items: DoorPublic[] }>("/api/doors"),
      jsonFetch<{ items: EmployeePublic[] }>("/api/employees"),
    ]);
    setItems(att.items);
    setDoors(door.items);
    setPeople(emp.items);
    if (!doorId && door.items[0]) setDoorId(door.items[0].id);
  }

  useEffect(() => {
    void load();
  }, [date]);

  const rows = useMemo(() => {
    const byEmp = new Map(items.map((item) => [item.employeeId, item]));
    return people
      .filter((person) => person.status === "active")
      .map((person) => {
        const rec = byEmp.get(person.id);
        return (
          rec ?? {
            employeeId: person.id,
            workDate: date,
            clockIn: null,
            clockOut: null,
            status: "absent",
            workMinutes: 0,
            breakMinutes: 0,
            lateMinutes: 0,
            overtimeMinutes: 0,
            employeeName: `${person.firstName} ${person.lastName}`,
            employeeNo: person.employeeNo,
            photoUrl: person.photoUrl,
            departmentName: person.departmentName ?? null,
            notes: null,
          }
        );
      });
  }, [items, people, date]);

  async function act(employeeId: number, action: AccessAction) {
    if (!doorId) return;
    const result = await jsonFetch<AccessResponse>("/api/attendance", {
      method: "POST",
      body: JSON.stringify({ employeeId, doorId, action }),
    });
    setMessage(result.message);
    await load();
  }

  return (
    <div>
      <PageHeader
        kicker="PDKS"
        title="İmza defteri"
        description="Kim kaçta geldi, kaçta çıktı. Geç kalanlar ve istirahat dakikaları aynı satırda. Operatör buradan da imza alabilir."
        actions={
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className={`${inputClass} max-w-xs`}
          value={doorId}
          onChange={(e) => setDoorId(Number(e.target.value))}
        >
          {doors.map((door) => (
            <option key={door.id} value={door.id}>
              {door.name}
            </option>
          ))}
        </select>
        {message ? <Badge tone="info">{message}</Badge> : null}
      </div>

      <div className="orion-card overflow-x-auto rounded-3xl p-5">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="pb-3">Personel</th>
              <th className="pb-3">Giriş</th>
              <th className="pb-3">Çıkış</th>
              <th className="pb-3">Çalışma</th>
              <th className="pb-3">İstirahat</th>
              <th className="pb-3">Geç</th>
              <th className="pb-3">Durum</th>
              <th className="pb-3">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="border-t border-white/5">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={row.photoUrl} name={row.employeeName} size="sm" />
                    <div>
                      <div className="text-white">{row.employeeName}</div>
                      <div className="text-xs text-slate-500">
                        {row.employeeNo} · {row.departmentName}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="font-mono text-cyan-200">{formatTimeTr(row.clockIn)}</td>
                <td className="font-mono text-cyan-200">{formatTimeTr(row.clockOut)}</td>
                <td>{formatMinutes(row.workMinutes)}</td>
                <td>{row.breakMinutes} dk</td>
                <td>{row.lateMinutes ? `${row.lateMinutes} dk` : "—"}</td>
                <td>
                  <Badge tone={!row.clockIn ? "bad" : row.lateMinutes > 0 ? "warn" : "ok"}>
                    {!row.clockIn ? "Yoklama yok" : row.clockOut ? "Kapandı" : "Devam ediyor"}
                  </Badge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Button className="px-2 py-1 text-xs" onClick={() => void act(row.employeeId, "clock_in")}>
                      Giriş
                    </Button>
                    <Button tone="gold" className="px-2 py-1 text-xs" onClick={() => void act(row.employeeId, "clock_out")}>
                      Çıkış
                    </Button>
                    <Button tone="ghost" className="px-2 py-1 text-xs" onClick={() => void act(row.employeeId, "break_start")}>
                      Mola
                    </Button>
                    <Button tone="ghost" className="px-2 py-1 text-xs" onClick={() => void act(row.employeeId, "break_end")}>
                      Dönüş
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
