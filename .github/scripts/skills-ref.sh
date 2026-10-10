#!/usr/bin/env bash
# The Agent Skills reference validator (agentskills/agentskills skills-ref) over every skill.
# It checks what claude plugin validate lets through: YAML that does not parse, name != folder,
# unknown fields. One error is ignored: `user-invocable` is a Claude Code field the open spec does
# not list, and CLAUDE.md requires it on sub-skills.
set -uo pipefail

# pinned so an upstream change cannot break CI unannounced; bump it on purpose
REF=69ef37e9424c0a7ea9dd2293b559e43ec8176379
SKILLS_REF=(uvx -q --from "git+https://github.com/agentskills/agentskills@$REF#subdirectory=skills-ref" skills-ref)
ALLOWED="Unexpected fields in frontmatter: user-invocable\. "

failed=0
for dir in */skills/*/; do
  out=$("${SKILLS_REF[@]}" validate "$dir" 2>&1) && continue
  errors=$(grep '^  - ' <<<"$out" | grep -v "$ALLOWED")
  # a failure with no listed error (a crash, a parse failure) is still a failure
  if [ -n "$errors" ] || ! grep -q '^  - ' <<<"$out"; then
    echo "::error file=${dir}SKILL.md::skills-ref: $(echo "${errors:-$out}" | sed 's/^  - //' | paste -sd ';' -)"
    failed=1
  fi
done
exit "$failed"
