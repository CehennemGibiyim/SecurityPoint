import { processAccessEvent, type AccessRequest } from "@/lib/access";
import { ensureSeed } from "@/lib/seed";
import type { AccessAction, BreakType } from "@/lib/types";

export const dynamic = "force-dynamic";
const ACTIONS = new Set<AccessAction>(["auto","clock_in","clock_out","break_start","break_end","door_only"]);

export async function POST(request: Request) {
  await ensureSeed();
  const body = (await request.json()) as Partial<AccessRequest> & { action?: AccessAction; breakType?: BreakType };
  if (!body.doorId || Number.isNaN(Number(body.doorId))) return Response.json({ error: "Kapı seçilmedi." }, { status: 400 });
  const action = body.action && ACTIONS.has(body.action) ? body.action : "auto";
  const result = await processAccessEvent({
    doorId: Number(body.doorId), action,
    descriptor: body.descriptor, employeeNo: body.employeeNo, employeeId: body.employeeId,
    snapshot: body.snapshot, breakType: body.breakType,
    livenessScore: body.livenessScore, isSpoof: body.isSpoof,
    cardNo: body.cardNo, qrToken: body.qrToken, pinCode: body.pinCode, authMethod: body.authMethod,
  });
  return Response.json(result, { status: 200 });
}
