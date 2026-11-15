#!/usr/bin/env bash
# SecurityPoint — yalnızca bu paketin Node sürecini ve kendi PostgreSQL kümesini kapatır.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/SecurityPoint-Yonet.sh" stop
