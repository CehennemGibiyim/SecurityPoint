/**
 * GitHub Pages (statik) sürümünün tarayıcı giriş noktası.
 *
 * Derleme: `node scripts/pages-build.mjs` → `_site/pglite/app.js`
 * Sayfaya `<script type="module" src=".../pglite/app.js">` ile eklenir.
 */
import { bootstrapBrowserApp } from "./bridge";

bootstrapBrowserApp();

// Duman testi şema onarımını üretim paketiyle aynı kod üzerinden sınamak için
// bu işlevleri kullanır (bkz. scripts/pages-smoke-test.mjs).
export { createSchema, schemaExists, schemaStatements } from "./schema";
