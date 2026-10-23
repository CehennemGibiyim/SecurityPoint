"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PersonelDetailClient } from "@/components/personel-detail-client";

function DetayInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "1";
  return <PersonelDetailClient employeeId={id} />;
}

export default function PersonelDetayQueryPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Kart açılıyor…</p>}>
      <DetayInner />
    </Suspense>
  );
}
