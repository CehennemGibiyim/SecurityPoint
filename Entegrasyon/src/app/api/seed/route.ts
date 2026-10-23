import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureSeed();
  return Response.json({ ok: true });
}

export async function GET() {
  await ensureSeed();
  return Response.json({ ok: true });
}
