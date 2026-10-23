/**
 * Statik sürümde sayfaya gömülen küçük önyükleme betiği.
 *
 * Amaç: veritabanı betiği (`pglite/app.js`) yüklenmeden önce sayfanın
 * bekleyebilmesi. Betik, çözülecek bir söz (promise) ve durum kanalı kurar;
 * `pglite/app.js` hazır olduğunda sözü çözer.
 *
 * Not: Bu metin yalnızca `output: "export"` derlemesinde (GitHub Pages)
 * kullanılır; sunuculu sürümde hiçbir etkisi yoktur.
 */
export const BROWSER_BOOT_INLINE = [
  "window.__P26_READY = new Promise(function (resolve, reject) {",
  "  window.__p26Resolve = resolve;",
  "  window.__p26Reject = reject;",
  "});",
  "window.__p26Status = function (message) {",
  "  window.__p26LastStatus = message;",
  "  try {",
  '    document.dispatchEvent(new CustomEvent("p26-status", { detail: message }));',
  "  } catch (e) { /* yok say */ }",
  "};",
].join("\n");
