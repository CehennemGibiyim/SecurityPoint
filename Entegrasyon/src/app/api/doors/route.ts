import { db } from "@/db";
import { doors } from "@/db/face-schema";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const items = await db.select().from(doors);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    code?: string;
    location?: string;
    type?: string;
    accessPolicy?: string;
    description?: string;
    imageUrl?: string;
  };
  if (!body.name || !body.code || !body.location) {
    return Response.json({ error: "Kapı adı, kodu ve lokasyonu zorunludur." }, { status: 400 });
  }
  const [item] = await db
    .insert(doors)
    .values({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      location: body.location.trim(),
      type: body.type === "entry" || body.type === "exit" ? body.type : "both",
      accessPolicy: body.accessPolicy === "all" ? "all" : "permission",
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
    })
    .returning();
  return Response.json({ item }, { status: 201 });
}
