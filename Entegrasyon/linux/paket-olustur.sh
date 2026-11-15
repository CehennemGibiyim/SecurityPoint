#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  SecurityPoint — Linux taşınabilir paket üreticisi (Windows betiğinin eşdeğeri)
#
#  Üretir: SecurityPoint-Portable/  ve  SecurityPoint-Portable-linux-x64.tar.gz
#  İçerik: Next.js standalone uygulaması + gömülü Node.js + gömülü PostgreSQL
#          + başlat/durdur/yedekle/tanı betikleri + masaüstü kısayolu.
#
#  Kullanım (Entegrasyon/ altında):
#    ./linux/paket-olustur.sh                      # derler + paketler
#    ./linux/paket-olustur.sh --skip-build         # CI'da derleme ayrı adımda
#    ./linux/paket-olustur.sh --pg-dir /usr/lib/postgresql/16
# ─────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE="$ROOT/.paket-cache"
OUT="$ROOT/SecurityPoint-Portable"
TARBALL="$ROOT/SecurityPoint-Portable-linux-x64.tar.gz"
NODE_VERSION="22.22.3"
PG_DIR=""
SKIP_BUILD=0
SKIP_NODE_DOWNLOAD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --skip-node-download) SKIP_NODE_DOWNLOAD=1 ;;
    --pg-dir) PG_DIR="${2:?--pg-dir bir yol ister}"; shift ;;
    --pg-dir=*) PG_DIR="${1#*=}" ;;
    --node-version) NODE_VERSION="${2:?--node-version bir değer ister}"; shift ;;
    --node-version=*) NODE_VERSION="${1#*=}" ;;
    *) echo "Bilinmeyen parametre: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { printf '\033[36m[linux]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[HATA]\033[0m %s\n' "$*" >&2; exit 1; }

# ── 1) Sürüm (tek kaynak: package.json) ───────────────────────────────
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/package.json" | head -1)"
[ -n "$VERSION" ] || die "package.json içinde sürüm bulunamadı."
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]] || die "Geçersiz sürüm: $VERSION"
log "Sürüm: $VERSION"

# ── 2) Derleme (isteğe bağlı) ─────────────────────────────────────────
if [ "$SKIP_BUILD" -eq 0 ]; then
  cd "$ROOT"
  [ -f package-lock.json ] && npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  npx next typegen
  npx tsc --noEmit --pretty false
  P26_APP_VERSION="$VERSION" npm run build
fi
[ -f "$ROOT/.next/standalone/server.js" ] || die "Next.js standalone çıktısı yok (.next/standalone/server.js)."

# ── 3) PostgreSQL çalıştırıcıları ─────────────────────────────────────
if [ -z "$PG_DIR" ]; then
  PG_DIR="$(ls -d /usr/lib/postgresql/*/ 2>/dev/null | sort -V | tail -1)"
  PG_DIR="${PG_DIR%/}"
fi
[ -x "$PG_DIR/bin/postgres" ] || die "PostgreSQL bulunamadı. --pg-dir ile belirtin (örn. /usr/lib/postgresql/16)."
PG_VERSION_TEXT="$(LD_LIBRARY_PATH="$PG_DIR/lib" "$PG_DIR/bin/postgres" --version 2>/dev/null || echo 'PostgreSQL')"
log "PostgreSQL: $PG_VERSION_TEXT ($PG_DIR)"

# ── 4) Node.js çalıştırıcısı ──────────────────────────────────────────
mkdir -p "$CACHE"
NODE_ARCH="linux-x64"
NODE_FILE="node-v$NODE_VERSION-$NODE_ARCH.tar.xz"
NODE_TAR="$CACHE/$NODE_FILE"
if [ "$SKIP_NODE_DOWNLOAD" -eq 1 ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
  log "Node.js: sistemdeki $( "$NODE_BIN" -v ) kullanılıyor (indirme atlandı)."
else
  if [ ! -f "$NODE_TAR" ]; then
    log "Node.js $NODE_VERSION indiriliyor..."
    curl -fsSL --retry 4 --retry-delay 5 -o "$NODE_TAR" "https://nodejs.org/dist/v$NODE_VERSION/$NODE_FILE"
  fi
  SUMS="$(curl -fsSL --retry 4 "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt")"
  EXPECTED="$(printf '%s\n' "$SUMS" | awk -v f="$NODE_FILE" '$2 == f {print $1}' | head -1)"
  [ -n "$EXPECTED" ] || die "Node.js checksum kaydı bulunamadı."
  ACTUAL="$(sha256sum "$NODE_TAR" | awk '{print $1}')"
  [ "$ACTUAL" = "$EXPECTED" ] || die "Node.js SHA-256 doğrulaması başarısız."
  rm -rf "$CACHE/node-extract" && mkdir -p "$CACHE/node-extract"
  tar -xJf "$NODE_TAR" -C "$CACHE/node-extract"
  NODE_BIN="$CACHE/node-extract/node-v$NODE_VERSION-$NODE_ARCH/bin/node"
fi
[ -x "$NODE_BIN" ] || die "Node.js çalıştırıcısı bulunamadı."
log "Node.js: $( "$NODE_BIN" -v )"

# ── 5) Paket klasörü ──────────────────────────────────────────────────
rm -rf "$OUT"
mkdir -p "$OUT/app" "$OUT/node/bin" "$OUT/pgsql"
cp -a "$ROOT/.next/standalone/." "$OUT/app/"
mkdir -p "$OUT/app/.next/static"
cp -a "$ROOT/.next/static/." "$OUT/app/.next/static/"
# DIKKAT: .next/standalone/public zaten var olabilir; klasörü kopyalamak
# public/public iç içe yapısı üretir ve gerçek varlıklar pakete girmez.
[ -d "$ROOT/public" ] && mkdir -p "$OUT/app/public" && cp -a "$ROOT/public/." "$OUT/app/public/"
# Geliştirme ortamı sırları pakete girmez.
find "$OUT/app" -maxdepth 2 -name '.env*' -type f -delete 2>/dev/null || true

cp "$NODE_BIN" "$OUT/node/bin/node"
chmod +x "$OUT/node/bin/node"
for lic in LICENSE LICENSE.md; do
  [ -f "$CACHE/node-extract/node-v$NODE_VERSION-$NODE_ARCH/$lic" ] && cp "$CACHE/node-extract/node-v$NODE_VERSION-$NODE_ARCH/$lic" "$OUT/node/$lic"
done

for dir in bin lib share; do
  [ -d "$PG_DIR/$dir" ] && cp -a "$PG_DIR/$dir" "$OUT/pgsql/$dir"
done
# PostgreSQL ikili dosyalarının sistem kütüphanesi bağımlılıklarını pakete taşı
# (glibc/ld-linux hariç: onlar hedef makineden gelmeli).
copy_runtime_libs() {
  local target_dir="$OUT/pgsql/lib"
  local skip='linux-vdso|ld-linux|libc\.so|libm\.so|libpthread|libdl\.so|librt\.so|libutil\.so|libresolv|libnsl|libcrypt\.so'
  local binaries deps
  binaries="$(find "$OUT/pgsql/bin" "$OUT/pgsql/lib" -type f \( -perm -u+x -o -name '*.so*' \) 2>/dev/null || true)"
  [ -n "$binaries" ] || return 0
  # ldd, betik/statik dosyalarda hata döndürür; bu beklenen bir durumdur.
  deps="$(printf '%s\n' "$binaries" | xargs -r ldd 2>/dev/null | grep -E '=> /' | sed 's/^[[:space:]]*//' || true)"
  [ -n "$deps" ] || return 0
  local lib src
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      *"$OUT/pgsql"*) continue ;;
    esac
    lib="$(printf '%s' "$line" | awk '{print $1}')"
    [ -f "$lib" ] || continue
    printf '%s' "$lib" | grep -Eq "$skip" && continue
    src="$target_dir/$(basename "$lib")"
    if [ ! -f "$src" ]; then cp -L "$lib" "$target_dir/" 2>/dev/null || true; fi
  done <<< "$deps"
  return 0
}
copy_runtime_libs

# ── 6) Betikler, şema, simgeler, kısayol ──────────────────────────────
for f in SecurityPoint-Yonet.sh SecurityPoint-Baslat.sh SecurityPoint-Durdur.sh SecurityPoint-Yedekle.sh OKU-BENI.md securitypoint.desktop; do
  cp "$SCRIPT_DIR/$f" "$OUT/$f"
done
chmod +x "$OUT"/*.sh
cp "$ROOT/windows/schema.sql" "$OUT/schema.sql"
cp "$ROOT/windows/schema-update.sql" "$OUT/schema-update.sql"
mkdir -p "$OUT/brand"
cp "$ROOT/public/brand/securitypoint.ico" "$OUT/brand/securitypoint.ico"
cp "$ROOT/public/brand/pwa-512.png" "$OUT/brand/securitypoint.png"

cat > "$OUT/manifest.json" <<JSON
{
  "application": "$VERSION",
  "platform": "linux-x64",
  "product": "SecurityPoint — ORION FaceGate x Puantaj26",
  "node": "$NODE_VERSION",
  "postgresql": "$(printf '%s' "$PG_VERSION_TEXT" | tr -d '"' | sed 's/.*) //')",
  "icon": "brand/securitypoint.png",
  "builtAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
JSON

# ── 7) Arşiv ──────────────────────────────────────────────────────────
rm -f "$TARBALL"
tar -czf "$TARBALL" -C "$ROOT" "$(basename "$OUT")"
sha256sum "$TARBALL" | awk '{print $1"  "$2}' > "$TARBALL.sha256"

log "Taşınabilir klasör : $OUT"
log "Arşiv              : $TARBALL ($(du -h "$TARBALL" | cut -f1))"
log "SHA-256            : $(cat "$TARBALL.sha256")"
