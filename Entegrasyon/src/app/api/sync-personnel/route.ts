import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/seed";
import { ensureSeeded as ensureP26Seeded } from "@/lib/server/core";
import { syncAllPersonnelBothWays } from "@/lib/personnel-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await ensureSeed();
    await ensureP26Seeded();
    const counts = await syncAllPersonnelBothWays();
    return NextResponse.json({ ok: true, ...counts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Senkronizasyon başarısız." },
      { status: 500 },
    );
  }
}
