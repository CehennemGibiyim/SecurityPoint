import type { SmtpSettings } from "@/lib/settings";

/**
 * Ücretsiz e-posta bildirimi — kendi SMTP hesabınızla çalışır (Gmail uygulama
 * şifresi vb.). smtp.enabled değil veya alanlar boşsa hiçbir şey gönderilmez.
 *
 * Sunucu tarafı koddur; yalnızca gerçek Node sunucusunda (Windows sürümü)
 * çalışır. GitHub Pages'de bu modül hiç çağrılмaz (sunucu yok).
 */
export type LeaveMailPayload = {
  employeeName: string;
  employeeNo: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  approvedBy: string;
};

const DECISION_TR: Record<string, string> = { approved: "ONAYLANDI", rejected: "REDDEDİLDİ" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : char === ">" ? "&gt;" : char === '"' ? "&quot;" : "&#39;",
  );
}

export function smtpReady(smtp: SmtpSettings | null | undefined): smtp is SmtpSettings {
  return Boolean(smtp && smtp.enabled && smtp.host && smtp.user && smtp.to);
}

export async function sendLeaveDecisionMail(smtp: SmtpSettings, payload: LeaveMailPayload): Promise<boolean> {
  if (!smtpReady(smtp)) return false;
  try {
    // Bu modül bridge tarafından tarayıcıya da paketlenir (izin rota tablosu):
    // tarayıcıda asla gönderim yapma; nodemailer içe aktarımı paketleyicinin
    // analiz edemmesi için değişken adla yapılır (yalnızca gerçek Node'da çözülür).
    if (typeof window !== "undefined") {
      console.warn("[mail] Gönderim yalnızca sunuculu (Windows) sürümünde çalışır; tarayıcıda atlandı.");
      return false;
    }
    const moduleName = "nodemailer";
    const nodemailer = (await import(moduleName)) as typeof import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    const decision = DECISION_TR[payload.status] ?? payload.status;
    const rows: Array<[string, string]> = [
      ["Personel", `${payload.employeeName}${payload.employeeNo ? ` (${payload.employeeNo})` : ""}`],
      ["İzin türü", payload.type],
      ["Tarih", `${payload.startDate} → ${payload.endDate} · ${payload.days} gün`],
      ["Gerekçe", payload.reason || "—"],
      ["Karar", decision],
      ["Onaylayan", payload.approvedBy || "—"],
    ];
    await transport.sendMail({
      from: smtp.from || smtp.user,
      to: smtp.to,
      subject: `[Personel26] İzin ${decision}: ${payload.employeeName}`,
      text: rows.map(([key, value]) => `${key}: ${value}`).join("\n"),
      html:
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">` +
        `<h2 style="margin:0 0 12px;color:${payload.status === "rejected" ? "#e11d48" : "#059669"}">İzin ${decision}</h2>` +
        `<table cellpadding="4" cellspacing="0">${rows
          .map(
            ([key, value]) =>
              `<tr><td style="color:#64748b;white-space:nowrap;padding-right:10px">${escapeHtml(key)}</td>` +
              `<td><b>${escapeHtml(value)}</b></td></tr>`,
          )
          .join("")}</table>` +
        `<p style="color:#94a3b8;font-size:12px;margin-top:14px">Personel26 · ORION FaceGate otomatik bildirimi</p></div>`,
    });
    return true;
  } catch (error) {
    console.warn("[mail] E-posta gönderilemedi:", error instanceof Error ? error.message : String(error));
    return false;
  }
}
