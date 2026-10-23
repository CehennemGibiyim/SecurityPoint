import { connection } from "next/server";
import { ensureSeeded, getBootstrap, ensureDailyBackup } from "@/lib/server/core";
import AppShell, { type BootstrapPayload } from "@/components/AppShell";
import BrowserDbGate from "@/components/BrowserDbGate";

/**
 * GitHub Pages (statik) derlemesinde veritabanı tarayıcıda çalışır:
 * sayfa sunucuda veri çekmez, panel hazır olduğunda istemci `/api/bootstrap`
 * çağrısını tarayıcı içindeki köprüden yapar.
 */
const BROWSER_DB = process.env.NEXT_PUBLIC_P26_BROWSER_DB === "1";

export default async function Home() {
  if (BROWSER_DB) {
    return (
      <BrowserDbGate>
        <AppShell />
      </BrowserDbGate>
    );
  }

  // Sunuculu sürüm: veri her istekte tazelenir (statik üretim yerine istek anında).
  await connection();

  // Sunucu tarafında veriyi hazırla; olası bir hata sayfayı düşürmesin —
  // istemci tarafı yedek yükleme (loadBootstrap) devreye girer.
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
  return <AppShell initialData={data} />;
}
