#!/usr/bin/env bash
# SecurityPoint — data/backups içine yerel PostgreSQL SQL yedeği alır.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$ROOT/SecurityPoint-Yonet.sh" backup
status=$?
if [ $status -eq 0 ]; then
  echo
  echo "Son yedekler:"
  ls -1t "$ROOT/data/backups" 2>/dev/null | head -5
else
  echo
  echo "Yedek alınamadı. Ayrıntı: $ROOT/data/yonet.log"
  read -r -p "Kapatmak için Enter'a basın..." _ || true
fi
exit $status
