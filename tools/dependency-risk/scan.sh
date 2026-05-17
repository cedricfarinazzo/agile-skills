#!/usr/bin/env bash
set -euo pipefail
RESULTS_DIR="$(dirname "$0")/results"
mkdir -p "$RESULTS_DIR"
SUMMARY="$RESULTS_DIR/summary.json"

# Basic scanner: prefer npm audit if package.json present
if [ -f package.json ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Running npm audit..."
    npm audit --json > "$RESULTS_DIR/npm-audit.json" 2>/dev/null || true
    # crude detection of vulnerabilities
    if grep -q '"vulnerabilities"' "$RESULTS_DIR/npm-audit.json" 2>/dev/null; then
      # attempt to count vulnerabilities using jq if available
      if command -v jq >/dev/null 2>&1; then
        VULN_COUNT=$(jq '.metadata.vulnerabilities | map_values(.) | add' "$RESULTS_DIR/npm-audit.json" 2>/dev/null || echo 0)
      else
        # fallback: mark as found
        VULN_COUNT=1
      fi
      if [ "$VULN_COUNT" != "0" ]; then
        printf '{"status":"vulnerabilities_found","tool":"npm audit","vulnerabilities":%s}\n' "$VULN_COUNT" > "$SUMMARY"
        exit 1
      fi
    fi
    printf '{"status":"clean","tool":"npm audit"}\n' > "$SUMMARY"
    exit 0
  else
    printf '{"status":"package.json_found_but_npm_missing"}\n' > "$SUMMARY"
    exit 0
  fi
elif [ -f requirements.txt ]; then
  printf '{"status":"requirements.txt_found","note":"no scanner implemented for pip in this script"}' > "$SUMMARY"
  exit 0
else
  printf '{"status":"no_dependency_manifest_found"}' > "$SUMMARY"
  exit 0
fi
