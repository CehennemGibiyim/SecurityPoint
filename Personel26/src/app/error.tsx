"use client";

/**
 * Sayfa düzeyi hata sınırı: herhangi bir çalışma zamanı hatasında
 * boş/donuk ekran yerine açıklayıcı mesaj + tek tıkla kurtarma sunar.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-xl">⚠️</div>
        <h1 className="text-white font-bold text-sm">Bir sorun oluştu</h1>
        <p className="text-white/50 text-xs break-words">{error?.message || "Beklenmeyen bir hata."}</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition"
          >Tekrar Dene</button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold transition"
          >Sayfayı Yenile</button>
        </div>
      </div>
    </div>
  );
}
