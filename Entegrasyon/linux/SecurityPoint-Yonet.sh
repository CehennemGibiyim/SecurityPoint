#!/usr/bin/env bash
# SecurityPoint — Linux yönetim betiği (taşınabilir paket).
# Kullanım: ./SecurityPoint-Yonet.sh [start|stop|backup|restore|update|doctor|kiosk]
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA="$ROOT/data"
PG_BIN="$ROOT/pgsql/bin"
PGDATA="$DATA/pgdata"
CONFIG="$DATA/connection.json"
MANIFEST="$ROOT/manifest.json"
LOGFILE="$DATA/yonet.log"
ERRFILE="$DATA/baslatma-hatasi.txt"
NODE="$ROOT/node/bin/node"
APP_DIR="$ROOT/app"
UPDATE_TIMESTAMP="$DATA/update-check.txt"
REPO="CehennemGibiyim/SecurityPoint"

export LD_LIBRARY_PATH="$ROOT/pgsql/lib:${LD_LIBRARY_PATH:-}"

ACTION="${1:-start}"
mkdir -p "$DATA"

# ── yardımcılar ────────────────────────────────────────────────────────
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOGFILE" >&2; }

fail() {
  local message="$1"
  local detail="${2:-}"
  log "HATA: $message ${detail}"
  {
    echo "SecurityPoint başlatılamadı."
    echo
    echo "$message"
    [ -n "$detail" ] && { echo; echo "Ayrıntı: $detail"; }
    echo
    echo "Günlük: $LOGFILE"
    echo "Tanılama: ./SecurityPoint-Yonet.sh doctor"
  } > "$ERRFILE"
  echo "SecurityPoint başlatılamadı: $message" >&2
  [ -n "$detail" ] && echo "$detail" >&2
  echo "Ayrıntılar: $ERRFILE" >&2
  exit 1
}

trap 'fail "Beklenmeyen hata (satır $LINENO)."' ERR

port_busy() {
  local port="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && { exec 3>&- 3<&-; return 0; }
  return 1
}

free_port() {
  local port="$1" limit=$(( $1 + 9 ))
  while [ "$port" -le "$limit" ]; do
    port_busy "$port" || { echo "$port"; return 0; }
    port=$(( port + 1 ))
  done
  fail "Boş port bulunamadı ($1-$limit)."
}

cfg() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$CONFIG" | head -1
}

write_config() {
  local user="$1" password="$2" database="$3" pgport="$4" appport="$5" autoupdate="$6"
  umask 077
  cat > "$CONFIG" <<JSON
{
  "user": "$user",
  "password": "$password",
  "database": "$database",
  "pgPort": $pgport,
  "appPort": $appport,
  "autoUpdate": $autoupdate
}
JSON
  umask 022
}

app_version() {
  [ -f "$MANIFEST" ] || { echo ""; return; }
  sed -n 's/.*"application"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$MANIFEST" | head -1
}

ensure_config() {
  if [ -f "$CONFIG" ]; then
    DBUSER="$(cfg user)"; DBPASS="$(cfg password)"; DBNAME="$(cfg database)"
    PGPORT="$(cfg pgPort)"; APPPORT="$(cfg appPort)"; AUTO_UPDATE="$(cfg autoUpdate)"
    AUTO_UPDATE="${AUTO_UPDATE:-true}"
    return 0
  fi
  DBUSER="securitypoint"
  DBPASS="$(head -c 32 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-32)"
  DBNAME="personel26"
  PGPORT="$(free_port 5433)"
  APPPORT="$(free_port 3210)"
  AUTO_UPDATE="true"
  write_config "$DBUSER" "$DBPASS" "$DBNAME" "$PGPORT" "$APPPORT" "$AUTO_UPDATE"
  log "İlk kurulum yapılandırması oluşturuldu (data/connection.json, erişim izni 600)."
}

start_pg() {
  "$PG_BIN/pg_ctl" status -D "$PGDATA" >/dev/null 2>&1 && return 0
  if port_busy "$PGPORT"; then
    local newport
    newport="$(free_port $(( PGPORT + 1 )))"
    log "PostgreSQL portu $PGPORT dolu; $newport portuna geçiliyor."
    PGPORT="$newport"
    write_config "$DBUSER" "$DBPASS" "$DBNAME" "$PGPORT" "$APPPORT" "$AUTO_UPDATE"
  fi
  "$PG_BIN/pg_ctl" start -D "$PGDATA" -l "$DATA/postgres.log" -w -t 60 \
    -o "-p $PGPORT -c listen_addresses=127.0.0.1" >/dev/null
  for _ in $(seq 1 60); do
    "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1 && { log "PostgreSQL hazır."; return 0; }
    sleep 1
  done
  fail "PostgreSQL 60 saniyede başlamadı." "data/postgres.log dosyasını inceleyin."
}

ensure_database() {
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    local pwfile="$DATA/pw-$$.tmp"
    umask 077; printf '%s' "$DBPASS" > "$pwfile"; umask 022
    "$PG_BIN/initdb" -D "$PGDATA" -U "$DBUSER" -A scram-sha-256 --pwfile="$pwfile" -E UTF8 --locale=C >/dev/null
    rm -f "$pwfile"
  fi
  start_pg
  local exists table
  if ! exists="$(PGPASSWORD="$DBPASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DBNAME'" 2>>"$DATA/postgres.log")"; then
    fail "Veritabanı bağlantısı kurulamadı." "data/postgres.log dosyasını inceleyin."
  fi
  [ "$exists" = "1" ] || PGPASSWORD="$DBPASS" "$PG_BIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" "$DBNAME"
  if ! table="$(PGPASSWORD="$DBPASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" -tAc \
      "SELECT to_regclass('public.personnel')" 2>>"$DATA/postgres.log")"; then
    fail "Şema kontrol edilemedi." "data/postgres.log dosyasını inceleyin."
  fi
  if [ "$table" = "" ]; then
    PGPASSWORD="$DBPASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" \
      -v ON_ERROR_STOP=1 --single-transaction -f "$ROOT/schema.sql" >/dev/null
    log "Şema ilk kez kuruldu."
  fi
  # Her başlatmada veri silmeyen idempotent güncelleme.
  PGPASSWORD="$DBPASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" \
    -v ON_ERROR_STOP=1 -f "$ROOT/schema-update.sql" >/dev/null
}

wait_health() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$APPPORT/api/health" 2>/dev/null | grep -q '"ok":true'; then
      return 0
    fi
    sleep 1
  done
  fail "Uygulama sağlık kontrolünü geçmedi." "data/app-error.log dosyasını inceleyin."
}

app_pid() { [ -f "$DATA/runtime.pid" ] && cat "$DATA/runtime.pid" 2>/dev/null || true; }

running() {
  local pid; pid="$(app_pid)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

stop_app() {
  if running; then
    local pid; pid="$(app_pid)"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$DATA/runtime.pid"
}

stop_all() {
  stop_app
  if [ -f "$PGDATA/PG_VERSION" ] && "$PG_BIN/pg_ctl" status -D "$PGDATA" >/dev/null 2>&1; then
    "$PG_BIN/pg_ctl" stop -D "$PGDATA" -m fast -w -t 60 >/dev/null
  fi
  log "SecurityPoint kapatıldı. Veriler data/ klasöründe korundu."
}

start_app() {
  running && { wait_health; return 0; }
  if port_busy "$APPPORT"; then
    local newport; newport="$(free_port $(( APPPORT + 1 )))"
    log "Uygulama portu $APPPORT dolu; $newport portuna geçiliyor."
    APPPORT="$newport"
    write_config "$DBUSER" "$DBPASS" "$DBNAME" "$PGPORT" "$APPPORT" "$AUTO_UPDATE"
  fi
  ensure_database
  [ -f "$APP_DIR/server.js" ] || fail "Uygulama dosyaları eksik (app/server.js)." "Paketi yeniden çıkarın."
  local encoded
  encoded="$("$NODE" -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DBPASS")"
  : > "$DATA/app.log"; : > "$DATA/app-error.log"
  (
    cd "$APP_DIR"
    DATABASE_URL="postgresql://$DBUSER:$encoded@127.0.0.1:$PGPORT/$DBNAME" \
    PORT="$APPPORT" HOSTNAME="127.0.0.1" NODE_ENV="production" \
    nohup "$NODE" server.js >> "$DATA/app.log" 2>> "$DATA/app-error.log" &
    echo $! > "$DATA/runtime.pid"
  )
  wait_health
}

open_browser() {
  local url="$1"
  [ "${P26_NO_BROWSER:-0}" = "1" ] || [ "${NO_BROWSER:-0}" = "1" ] && return 0
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 & fi
}

backup() {
  ensure_database
  local dir="$DATA/backups" target
  mkdir -p "$dir"
  target="${1:-$dir/personel26-$(date +%Y%m%d-%H%M%S).sql}"
  PGPASSWORD="$DBPASS" "$PG_BIN/pg_dump" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" \
    --clean --if-exists --no-owner --no-privileges -f "$target"
  [ -s "$target" ] || fail "SQL yedeği oluşturulamadı."
  log "SQL yedeği: $target"
}

# ── güncelleme ─────────────────────────────────────────────────────────
newer_version() {
  local candidate="$1" current="$2"
  [ -z "$candidate" ] && return 1
  [ "$candidate" = "$current" ] && return 1
  [ "$(printf '%s\n%s\n' "$candidate" "$current" | sort -V | tail -1)" = "$candidate" ]
}

update_from() {
  local source="$1"
  if [ ! -f "$source/app/server.js" ]; then
    log "Güncelleme paketi geçersiz: $source/app/server.js yok."
    return 1
  fi
  stop_app
  ensure_database
  local safety; safety="$DATA/backups/on-guncelleme-$(date +%Y%m%d-%H%M%S).sql"
  backup "$safety"
  rm -rf "$DATA/app-before-update"
  mv "$APP_DIR" "$DATA/app-before-update"
  if cp -a "$source/app" "$APP_DIR" \
    && cp -f "$source/schema-update.sql" "$ROOT/schema-update.sql" \
    && { [ ! -f "$source/manifest.json" ] || cp -f "$source/manifest.json" "$MANIFEST"; } \
    && start_app; then
    rm -rf "$DATA/app-before-update"
    log "Güncelleme tamamlandı. Veriler korundu. Güvenlik yedeği: $safety"
  else
    stop_app
    rm -rf "$APP_DIR"
    mv "$DATA/app-before-update" "$APP_DIR"
    start_app || true
    log "Güncelleme başarısız; önceki sürüm geri alındı. Güvenlik yedeği: $safety"
    return 1
  fi
}

auto_update() {
  [ "${P26_NO_UPDATE:-0}" = "1" ] && return 0
  [ "$AUTO_UPDATE" = "true" ] || return 0
  [ -f "$MANIFEST" ] || return 0
  local current; current="$(app_version)"
  [ -n "$current" ] || return 0
  if [ -f "$UPDATE_TIMESTAMP" ]; then
    local age=$(( ( $(date +%s) - $(date -r "$UPDATE_TIMESTAMP" +%s) ) / 3600 ))
    [ "$age" -lt 6 ] && return 0
  fi
  date -u '+%Y-%m-%dT%H:%M:%SZ' > "$UPDATE_TIMESTAMP"
  command -v curl >/dev/null 2>&1 || { log "curl yok; güncelleme denetlenemedi."; return 0; }

  local release latest url
  release="$(curl -fsSL --max-time 20 -H 'User-Agent: SecurityPoint' \
    "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || true)"
  [ -n "$release" ] || { log "Güncelleme denetimi yapılamadı (çevrimdışı olabilir)."; return 0; }
  latest="$(printf '%s' "$release" | grep -m1 '"tag_name"' | sed 's/.*: *"\([^"]*\)".*/\1/' | sed 's/^[vV]//')"
  if ! newer_version "$latest" "$current"; then return 0; fi
  url="$(printf '%s' "$release" | grep -o 'https://[^"]*SecurityPoint-Portable-linux-x64\.tar\.gz' | head -1)"
  [ -n "$url" ] || { log "Yeni sürüm ($latest) var ancak Linux paketi bulunamadı."; return 0; }

  log "Yeni sürüm bulundu: $latest (kurulu: $current). İndiriliyor..."
  local work="$DATA/updates/$latest"
  rm -rf "$work"; mkdir -p "$work"
  if curl -fsSL --max-time 900 -o "$work/pkg.tar.gz" "$url" && tar -xzf "$work/pkg.tar.gz" -C "$work"; then
    local extracted
    extracted="$(find "$work" -maxdepth 2 -name manifest.json -printf '%h\n' 2>/dev/null | head -1)"
    if [ -n "$extracted" ]; then
      update_from "$extracted" || log "Otomatik güncelleme uygulanamadı; mevcut sürümle devam ediliyor."
    else
      log "İndirilen paket açılamadı; mevcut sürümle devam ediliyor."
    fi
  else
    log "Güncelleme indirilemedi; mevcut sürümle devam ediliyor."
  fi
  rm -rf "$work"
}

doctor() {
  local target="$DATA/tanilama.txt"
  {
    echo "SecurityPoint tanılama raporu"
    echo "Oluşturulma : $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Sürüm       : $(app_version)"
    echo "Klasör      : $ROOT"
    echo "Sistem      : $(uname -srm)"
    echo "Dağıtım     : $( (. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME") || echo 'bilinmiyor')"
    echo "Kullanıcı   : $(id -un 2>/dev/null)"
    echo
    echo "-- Dosyalar"
    for item in node/bin/node pgsql/bin/postgres app/server.js manifest.json schema.sql schema-update.sql; do
      [ -e "$ROOT/$item" ] && printf '%-28s var\n' "$item" || printf '%-28s YOK\n' "$item"
    done
    [ -f "$PGDATA/PG_VERSION" ] && printf '%-28s %s\n' 'data/pgdata' "$(cat "$PGDATA/PG_VERSION")" || printf '%-28s YOK\n' 'data/pgdata'
    echo
    echo "-- Yapılandırma"
    if [ -f "$CONFIG" ]; then
      echo "appPort    : $(cfg appPort)"
      echo "pgPort     : $(cfg pgPort)"
      echo "autoUpdate : $(cfg autoUpdate)"
      echo "Parola     : (güvenlik nedeniyle yazılmaz)"
    else
      echo "connection.json YOK"
    fi
    echo
    echo "-- Çalışma durumu"
    for p in "$(cfg appPort)" "$(cfg pgPort)"; do
      [ -n "$p" ] || continue
      port_busy "$p" && echo "port $p: DINLENIYOR" || echo "port $p: boş"
    done
    running && echo "Uygulama: çalışıyor (PID $(app_pid))" || echo "Uygulama: çalışmıyor"
    if [ -f "$PGDATA/PG_VERSION" ]; then
      "$PG_BIN/pg_ctl" status -D "$PGDATA" >/dev/null 2>&1 && echo "PostgreSQL: çalışıyor" || echo "PostgreSQL: kapalı"
    fi
    echo
    for f in app-error.log app.log postgres.log yonet.log; do
      echo "-- $f (son 25 satır)"
      if [ -f "$DATA/$f" ]; then tail -n 25 "$DATA/$f"; else echo "(dosya yok)"; fi
      echo
    done
  } > "$target"
  cat "$target"
  echo
  echo "Tanılama dosyası: $target"
}

# ── ana akış ───────────────────────────────────────────────────────────
case "$ACTION" in
  stop) stop_all ;;
  doctor) ensure_config; doctor ;;
  backup) ensure_config; backup ;;
  restore)
    ensure_config
    [ -n "${2:-}" ] && [ -f "${2}" ] || fail "Geçerli bir SecurityPoint SQL yedeği seçin." "Kullanım: $0 restore /yol/yedek.sql"
    stop_app; ensure_database
    safety="$DATA/backups/geri-yukleme-oncesi-$(date +%Y%m%d-%H%M%S).sql"; backup "$safety"
    PGPASSWORD="$DBPASS" "$PG_BIN/psql" -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" \
      -v ON_ERROR_STOP=1 --single-transaction -f "$2" >/dev/null
    start_app
    log "Geri yükleme tamamlandı. Güvenlik yedeği: $safety"
    ;;
  update)
    ensure_config
    [ -n "${2:-}" ] || fail "Güncelleme paketi klasörünü belirtin." "Kullanım: $0 update /yol/SecurityPoint-Portable"
    update_from "$2" || fail "Güncelleme başarısız." "Ayrıntı: data/yonet.log"
    ;;
  autoupdate-on) ensure_config; AUTO_UPDATE="true"; write_config "$DBUSER" "$DBPASS" "$DBNAME" "$PGPORT" "$APPPORT" "$AUTO_UPDATE"; log "Otomatik güncelleme açıldı." ;;
  autoupdate-off) ensure_config; AUTO_UPDATE="false"; write_config "$DBUSER" "$DBPASS" "$DBNAME" "$PGPORT" "$APPPORT" "$AUTO_UPDATE"; log "Otomatik güncelleme kapatıldı." ;;
  start|kiosk)
    ensure_config
    [ -x "$NODE" ] || fail "Pakette taşınabilir Node.js eksik." "node/bin/node bulunamadı."
    [ -x "$PG_BIN/postgres" ] || fail "Pakette PostgreSQL eksik." "pgsql/bin/postgres bulunamadı."
    [ -f "$APP_DIR/server.js" ] || fail "Uygulama dosyaları eksik." "app/server.js bulunamadı."
    auto_update
    start_app
    url="http://127.0.0.1:$APPPORT"
    [ "$ACTION" = "kiosk" ] && url="$url/terminal?kiosk=1"
    open_browser "$url"
    log "SecurityPoint hazır: $url"
    ;;
  *) echo "Bilinmeyen komut: $ACTION" >&2; echo "Kullanım: $0 [start|stop|kiosk|backup|restore|update|doctor|autoupdate-on|autoupdate-off]" >&2; exit 2 ;;
esac
