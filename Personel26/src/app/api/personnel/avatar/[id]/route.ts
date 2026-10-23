import { db } from "@/db";
import { personnel } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * base64 → bayt dizisi. `atob` hem Node.js (18+) hem tarayıcıda bulunduğu için
 * GitHub Pages sürümünde de (Buffer olmadan) çalışır.
 */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Personel profil fotoğrafını görsel olarak sunar (ETag + uzun önbellek). */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const row = (await db
    .select({ data: personnel.avatarData, mime: personnel.avatarMime, updatedAt: personnel.avatarUpdatedAt })
    .from(personnel)
    .where(eq(personnel.id, id)))[0];

  if (!row?.data || !row.mime) {
    return new Response(null, { status: 404 });
  }

  const etag = `"${id}-${row.updatedAt ? new Date(row.updatedAt).getTime() : 0}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const bytes = base64ToBytes(row.data);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
