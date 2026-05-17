#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [-n N] [-c 'TEST_CMD']"
  echo "  -n N      Number of runs (default 5)"
  echo "  -c CMD    Test command to run (overrides detection)"
  exit 1
}

N=5
TEST_CMD="${TEST_CMD:-}"
while getopts ":n:c:h" opt; do
  case $opt in
    n) N=$OPTARG ;;
    c) TEST_CMD=$OPTARG ;;
    h) usage ;;
    \?) echo "Invalid option: -$OPTARG" >&2; usage ;;
  esac
done

if [ -z "$TEST_CMD" ] || [ "$TEST_CMD" = "true # no tests detected" ]; then
  echo "No TEST_CMD provided; attempting heuristic detection..."
  if [ -f package.json ]; then TEST_CMD="npm test --silent"; fi
  if [ -f pytest.ini ] || git ls-files '*.py' | grep -q .; then TEST_CMD="pytest --maxfail=1 --disable-warnings -q"; fi
  if [ -f go.mod ]; then TEST_CMD="go test ./..."; fi
  if [ -z "$TEST_CMD" ]; then
    echo "No test command detected; nothing to run. Exiting."
    exit 0
  fi
fi

OUT_DIR="tmp/test_flake_runs"
mkdir -p "$OUT_DIR"

echo "Using TEST_CMD: $TEST_CMD"

for i in $(seq 1 $N); do
  echo "=== Run $i/$N ==="
  if echo "$TEST_CMD" | grep -q 'pytest'; then
    CMD="$TEST_CMD --junitxml $OUT_DIR/run_${i}.xml"
    set +e
    eval "$CMD" > "$OUT_DIR/run_${i}.log" 2>&1
    RC=$?
    set -e
    echo "$RC" > "$OUT_DIR/run_${i}.exit"
  else
    set +e
    eval "$TEST_CMD" > "$OUT_DIR/run_${i}.txt" 2>&1
    RC=$?
    set -e
    echo "$RC" > "$OUT_DIR/run_${i}.exit"
  fi
  sleep 1
done

echo "Runs completed. Outputs in $OUT_DIR"
ls -1 "$OUT_DIR"
