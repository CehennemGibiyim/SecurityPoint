/**
 * GitHub Pages (statik) sürümünün tarayıcı giriş noktası.
 *
 * Derleme: `node scripts/pages-build.mjs` → `_site/pglite/app.js`
 * Sayfaya `<script type="module" src=".../pglite/app.js">` ile eklenir.
 */
import { bootstrapBrowserApp } from "./bridge";

bootstrapBrowserApp();
