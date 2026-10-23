"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { withBasePath } from "@/lib/asset-path";
import { jsonFetch } from "@/lib/api-client";
import type { DoorPublic } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  entry: "Yalnız giriş",
  exit: "Yalnız çıkış",
  both: "Giriş + çıkış",
};

export default function KapilarPage() {
  const [doors, setDoors] = useState<DoorPublic[]>([]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    location: "",
    type: "both",
    accessPolicy: "permission",
    description: "",
  });

  async function load() {
    const data = await jsonFetch<{ items: DoorPublic[] }>("/api/doors");
    setDoors(data.items);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDoor() {
    await jsonFetch("/api/doors", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", code: "", location: "", type: "both", accessPolicy: "permission", description: "" });
    await load();
  }

  async function patch(id: number, body: Partial<DoorPublic>) {
    await jsonFetch(`/api/doors/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await load();
  }

  return (
    <div>
      <PageHeader
        kicker="Saha"
        title="Kapı noktaları"
        description="Turnike, üretim holü, sunucu odası ve yemekhane. Yetki politikası ‘izinli personel’ veya ‘herkes’ olabilir."
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {doors.map((door) => (
          <article key={door.id} className="orion-card overflow-hidden rounded-3xl">
            <div className="relative h-36">
              <img
                src={withBasePath(door.imageUrl || "/scenes/gate.jpg")}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] to-transparent" />
              <div className="absolute bottom-3 left-4">
                <p className="font-mono text-xs text-cyan-200">{door.code}</p>
                <h3 className="text-lg font-semibold text-white">{door.name}</h3>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-slate-400">{door.location}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">{TYPE_LABEL[door.type] ?? door.type}</Badge>
                <Badge tone={door.accessPolicy === "all" ? "gold" : "neutral"}>
                  {door.accessPolicy === "all" ? "Herkes geçebilir" : "Yetki gerekir"}
                </Badge>
                <Badge tone={door.isActive ? "ok" : "bad"}>
                  {door.isActive ? "Aktif" : "Kapalı"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">{door.description}</p>
              <div className="flex gap-2">
                <Button tone="ghost" onClick={() => void patch(door.id, { isLocked: !door.isLocked })}>
                  {door.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  {door.isLocked ? "Kilitli" : "Açık bırakıldı"}
                </Button>
                <Button tone="ghost" onClick={() => void patch(door.id, { isActive: !door.isActive })}>
                  {door.isActive ? "Devre dışı bırak" : "Aktifleştir"}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="orion-card rounded-3xl p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Yeni kapı</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Ad">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Kod">
            <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Lokasyon">
            <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Tip">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="entry">Giriş</option>
              <option value="exit">Çıkış</option>
              <option value="both">Çift yön</option>
            </select>
          </Field>
          <Field label="Politika">
            <select className={inputClass} value={form.accessPolicy} onChange={(e) => setForm({ ...form, accessPolicy: e.target.value })}>
              <option value="permission">Yetki gerekli</option>
              <option value="all">Tüm personel</option>
            </select>
          </Field>
          <Field label="Açıklama">
            <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        <Button className="mt-4" onClick={() => void createDoor()}>Kapıyı ekle</Button>
      </section>
    </div>
  );
}
