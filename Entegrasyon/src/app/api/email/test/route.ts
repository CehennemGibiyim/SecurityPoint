import { getSettings, requireSameOrigin } from "@/lib/server/settings";
import type { SmtpSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function str(value: unknown, max = 400): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitize(input: unknown): SmtpSettings | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const v = input as Record<string, unknown>;
  const port = Number(v.port);
  return {
    enabled: v.enabled === true,
    host: str(v.host, 200),
    port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 465,
    secure: typeof v.secure === "boolean" ? v.secure : true,
    user: str(v.user),
    pass: str(v.pass),
    from: str(v.from),
    to: str(v.to),
  };
}

/** SMTP bağlantı denemesi: doğrula + gerçek bir test mektubu gönder. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = (await request.json().catch(() => ({}))) as { smtp?: unknown };
    const smtp = sanitize(body.smtp) ?? (await getSettings()).smtp;
    if (!smtp.host || !smtp.user) {
      return Response.json({ ok: false, reason: "SMTP sunucu ve kullanıcı adı zorunludur." });
    }
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.verify();
    await transport.sendMail({
      from: smtp.from || smtp.user,
      to: smtp.to || smtp.user,
      subject: "[Personel26] SMTP testi",
      text: "Tebrikler — Personel26 e-posta bildirimi çalışıyor.",
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, reason: error instanceof Error ? error.message : "SMTP hatası" });
  }
}
