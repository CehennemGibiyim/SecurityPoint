/**
 * GitHub Pages (statik) sürümünde kullanılan sanal modül.
 * Gerçek içerik derleme sırasında scripts/pages-build.mjs tarafından
 * verilir: drizzle-kit'in ürettiği şema DDL'i (düz metin) gömülür.
 */
declare module "p26-schema-sql" {
  const ddl: string;
  export default ddl;
}
