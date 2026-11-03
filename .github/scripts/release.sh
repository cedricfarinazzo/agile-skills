#!/usr/bin/env bash
# Tags and releases every plugin whose current version has no "<plugin>@<version>" tag yet.
# Needs GH_TOKEN with contents: write. Idempotent: an existing tag is skipped.
set -euo pipefail
git fetch --tags --quiet
for p in $(jq -r '.plugins[].name' .claude-plugin/marketplace.json); do
  v=$(jq -r .version "$p/.claude-plugin/plugin.json")
  tag="$p@$v"
  git rev-parse -q --verify "refs/tags/$tag" >/dev/null && continue
  prev=$(git tag --list "$p@*" --sort=-v:refname | head -n1)
  args=(--title "$tag" --target "$GITHUB_SHA" --generate-notes)
  [ -n "$prev" ] && args+=(--notes-start-tag "$prev")
  echo "releasing $tag${prev:+ (since $prev)}"
  gh release create "$tag" "${args[@]}"
done
