/**
 * Uygulama sürümü — TEK KAYNAK: Entegrasyon/package.json içindeki "version" alanı.
 *
 * next.config.ts bu değeri derleme sırasında NEXT_PUBLIC_P26_VERSION olarak aktarır,
 * windows/paket-olustur.ps1 aynı değeri kurulum paketine ve manifest.json'a yazar.
 * Sürümü elle çoğaltmayın; yalnızca package.json değerini değiştirin.
 */
export const APP_VERSION = (process.env.NEXT_PUBLIC_P26_VERSION ?? "").trim();
export const APP_VERSION_LABEL = APP_VERSION ? `v${APP_VERSION}` : "";
