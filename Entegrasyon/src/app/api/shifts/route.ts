import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shifts } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await db.select().from(shifts);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    startTime?: string;
    endTime?: string;
    breakAllowanceMinutes?: number;
    lateToleranceMinutes?: number;
    color?: string;
  };
  if (!body.name || !body.startTime || !body.endTime) {
    return Response.json({ error: "Vardiya adı ve saatler zorunludur." }, { status: 400 });
  }
  const [item] = await db
    .insert(shifts)
    .values({
      name: body.name.trim(),
      startTime: body.startTime,
      endTime: body.endTime,
      breakAllowanceMinutes: body.breakAllowanceMinutes ?? 60,
      lateToleranceMinutes: body.lateToleranceMinutes ?? 10,
      color: body.color || "#818cf8",
    })
    .returning();
  return Response.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: number;
    name?: string;
    startTime?: string;
    endTime?: string;
    breakAllowanceMinutes?: number;
    lateToleranceMinutes?: number;
  };
  if (!body.id) return Response.json({ error: "id gerekli" }, { status: 400 });
  const [item] = await db
    .update(shifts)
    .set({
      name: body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      breakAllowanceMinutes: body.breakAllowanceMinutes,
      lateToleranceMinutes: body.lateToleranceMinutes,
    })
    .where(eq(shifts.id, body.id))
    .returning();
  return Response.json({ item });
}
