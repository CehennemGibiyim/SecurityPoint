import { connection } from "next/server";
import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";
import AppShell, { type BootstrapPayload, type PageKey } from "@/components/AppShell";

const BROWSER_DB = process.env.NEXT_PUBLIC_P26_BROWSER_DB === "1";

export default async function P26PageEntry({ pageKey }: { pageKey: PageKey }) {
  if (BROWSER_DB) {
    return <AppShell initialPage={pageKey} embedded />;
  }

  await connection();

  let data: BootstrapPayload | undefined;
  try {
    await ensureSeeded();
    ensureDailyBackup().catch(() => {});
    const boot = await getBootstrap();
    const now = new Date();
    data = {
      ...(boot as unknown as BootstrapPayload),
      today: { year: now.getFullYear(), month: now.getMonth() },
    };
  } catch {
    data = undefined;
  }

  return <AppShell initialData={data} initialPage={pageKey} embedded />;
}
