#!/bin/sh
# Minimal POSIX dependency risk scanner
RESULTS_DIR="tools/dependency-risk/results"
mkdir -p "$RESULTS_DIR"
FOUND=0
HAS_ISSUE=0

# Node
if [ -f package.json ]; then
  FOUND=1
  if command -v npm >/dev/null 2>&1; then
    npm audit --json > "$RESULTS_DIR/npm-audit.json" 2>/dev/null || true
  else
    echo '{"error":"npm not found"}' > "$RESULTS_DIR/npm-audit.json"
  fi
fi

# Python
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then
  FOUND=1
  if command -v pip-audit >/dev/null 2>&1; then
    pip-audit -f json > "$RESULTS_DIR/pip-audit.json" 2>/dev/null || true
  else
    echo '{"error":"pip-audit not found"}' > "$RESULTS_DIR/pip-audit.json"
  fi
fi

if [ "$FOUND" -eq 0 ]; then
  echo '{"error":"no supported manifest found"}' > "$RESULTS_DIR/scan.json"
  echo "No supported package manifests found"
  exit 0
fi

# Analyze results: prefer jq if available
if command -v jq >/dev/null 2>&1; then
  if [ -f "$RESULTS_DIR/npm-audit.json" ]; then
    if jq -e '((.metadata.vulnerabilities.high // 0) + (.metadata.vulnerabilities.critical // 0)) > 0' "$RESULTS_DIR/npm-audit.json" >/dev/null 2>&1; then
      HAS_ISSUE=1
    fi
  fi
  if [ -f "$RESULTS_DIR/pip-audit.json" ]; then
    if jq -e '.vulns[]? | select(.severity=="HIGH" or .severity=="CRITICAL")' "$RESULTS_DIR/pip-audit.json" >/dev/null 2>&1; then
      HAS_ISSUE=1
    fi
  fi
else
  if [ -f "$RESULTS_DIR/npm-audit.json" ]; then
    if grep -E '"high|critical|HIGH|CRITICAL"' "$RESULTS_DIR/npm-audit.json" >/dev/null 2>&1; then HAS_ISSUE=1; fi
  fi
  if [ -f "$RESULTS_DIR/pip-audit.json" ]; then
    if grep -E '"high|critical|HIGH|CRITICAL"' "$RESULTS_DIR/pip-audit.json" >/dev/null 2>&1; then HAS_ISSUE=1; fi
  fi
fi

if [ "$HAS_ISSUE" -eq 1 ]; then
  echo "High/critical issues found"
  exit 2
fi

echo "No high/critical issues found"
exit 0
