#!/usr/bin/env bash
# SecurityPoint — başlatıcı (çift tıklama / menü kısayolu).
# Hata olursa pencere kapanmaz; mesaj ve tanılama yolu gösterilir.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$ROOT/SecurityPoint-Yonet.sh" start
status=$?

if [ $status -ne 0 ]; then
  echo
  echo "SecurityPoint başlatılamadı."
  [ -f "$ROOT/data/baslatma-hatasi.txt" ] && { echo; cat "$ROOT/data/baslatma-hatasi.txt"; }
  echo
  read -r -p "Kapatmak için Enter'a basın..." _ || true
fi
exit $status
