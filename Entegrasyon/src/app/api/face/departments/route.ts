import { db } from "@/db";
import { departments } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await db.select().from(departments);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; code?: string; color?: string };
  if (!body.name || !body.code) {
    return Response.json({ error: "Ad ve kod zorunludur." }, { status: 400 });
  }
  const [item] = await db
    .insert(departments)
    .values({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      color: body.color || "#22d3ee",
    })
    .returning();
  return Response.json({ item }, { status: 201 });
}
