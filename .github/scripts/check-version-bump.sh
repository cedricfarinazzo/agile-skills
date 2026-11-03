#!/usr/bin/env bash
# Fails when a plugin dir changed since BASE but its .claude-plugin/plugin.json version did not.
# Usage: check-version-bump.sh <base-ref>
set -euo pipefail
base=$(git merge-base "$1" HEAD)
fail=0
for p in $(jq -r '.plugins[].name' .claude-plugin/marketplace.json); do
  manifest="$p/.claude-plugin/plugin.json"
  git diff --quiet "$base" HEAD -- "$p" && continue
  old=$(git show "$base:$manifest" 2>/dev/null | jq -r .version) || continue  # new plugin
  new=$(jq -r .version "$manifest")
  if [ "$old" = "$new" ]; then
    echo "::error file=$manifest::$p changed but its version is still $old — bump it (CONTRIBUTING.md step 4)"
    fail=1
  else
    echo "$p: $old -> $new"
  fi
done
exit $fail
