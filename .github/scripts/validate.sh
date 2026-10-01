#!/usr/bin/env bash
# claude plugin validate <path>, failing on a warning too: CLAUDE.md requires both to pass with none.
set -uo pipefail

out=$(claude plugin validate "$1" 2>&1)
status=$?
echo "$out"
[ "$status" -eq 0 ] || exit "$status"
if grep -qiE '⚠|warning' <<<"$out"; then
  echo "::error::claude plugin validate $1 reported a warning"
  exit 1
fi
