#!/usr/bin/env bash
# sprint-shared-file-audit.sh — detect shared-file collisions across sprint stories
#
# Bundled with agile-8-refinement skill. Project-agnostic: pass any Jira project
# key via --project (defaults to env JIRA_PROJECT).
#
# Requires: curl, jq (for live Jira mode)
# Env vars (live mode only): JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT
#
# Usage:
#   sprint-shared-file-audit.sh ABC-28 ABC-30 ABC-39 ...                        (explicit keys)
#   sprint-shared-file-audit.sh --project ABC --sprint "Sprint 4"                (JQL mode)
#   sprint-shared-file-audit.sh --fixture path/to/fixture.tsv ABC-28 ABC-30 ...
#
# Exit codes: 0=clean, 1=collisions/watchlist-hits, 2=arg/env error

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] [STORY_KEY ...]

Detect shared-file ownership collisions across sprint stories.

Options:
  -w, --watchlist <path>   Optional: per-repo watchlist of always-shared files.
                           Any single story touching one of these triggers a
                           "watchlist hit" row. Omit to skip the section.
  -p, --project <KEY>      Jira project key (also via env JIRA_PROJECT)
  -s, --sprint <name>      JQL sprint name — fetches story keys via Jira API
  -f, --fixture <path>     Offline fixture TSV (STORY<TAB>file1<TAB>file2 ...)
  -v, --verbose            Print raw extracted text per story
  -h, --help               Show this help

Environment (required for live Jira mode):
  JIRA_BASE_URL            e.g. https://yourorg.atlassian.net
  JIRA_EMAIL               Atlassian account email
  JIRA_API_TOKEN           Atlassian API token
  JIRA_PROJECT             Jira project key (or pass --project)

Examples:
  # Live mode — explicit keys (collisions only, no watchlist)
  JIRA_BASE_URL=https://example.atlassian.net JIRA_EMAIL=pm@co JIRA_API_TOKEN=xxx JIRA_PROJECT=ABC \\
    $(basename "$0") ABC-28 ABC-30 ABC-39 ABC-40 ABC-41

  # Live mode — full sprint
  $(basename "$0") --project ABC --sprint "Sprint 4"

  # Offline mode — fixture file
  $(basename "$0") --fixture ./my-sprint-fixture.tsv ABC-28 ABC-30 ABC-39 ABC-40 ABC-41

  # With per-repo watchlist
  $(basename "$0") -w ./scripts/lib/shared-file-watchlist.txt ABC-28 ABC-30

Watchlist file format (one path per line, # for comments):
  CLAUDE.md
  docker-compose.yml
  backend/scheduler/main.py
EOF
}

# ---------- arg parsing ----------
WATCHLIST_PATH=""
SPRINT_NAME=""
FIXTURE_PATH=""
VERBOSE=0
PROJECT_KEY="${JIRA_PROJECT:-}"
STORY_KEYS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)    usage; exit 0 ;;
    -v|--verbose) VERBOSE=1; shift ;;
    -w|--watchlist)
      [[ $# -lt 2 ]] && { echo "ERROR: --watchlist requires a path" >&2; exit 2; }
      WATCHLIST_PATH="$2"; shift 2 ;;
    -p|--project)
      [[ $# -lt 2 ]] && { echo "ERROR: --project requires a key" >&2; exit 2; }
      PROJECT_KEY="$2"; shift 2 ;;
    -s|--sprint)
      [[ $# -lt 2 ]] && { echo "ERROR: --sprint requires a name" >&2; exit 2; }
      SPRINT_NAME="$2"; shift 2 ;;
    -f|--fixture)
      [[ $# -lt 2 ]] && { echo "ERROR: --fixture requires a path" >&2; exit 2; }
      FIXTURE_PATH="$2"; shift 2 ;;
    -*)
      echo "ERROR: unknown option '$1'" >&2; exit 2 ;;
    *)
      STORY_KEYS+=("$1"); shift ;;
  esac
done

# ---------- validate watchlist (optional) ----------
if [[ -n "${WATCHLIST_PATH}" && ! -f "${WATCHLIST_PATH}" ]]; then
  echo "ERROR: watchlist not found: ${WATCHLIST_PATH}" >&2
  exit 2
fi

# ---------- resolve story keys ----------
if [[ -n "${SPRINT_NAME}" ]]; then
  for var in JIRA_BASE_URL JIRA_EMAIL JIRA_API_TOKEN; do
    [[ -z "${!var:-}" ]] && { echo "ERROR: env var ${var} required for JQL mode" >&2; exit 2; }
  done
  if [[ -z "${PROJECT_KEY}" ]]; then
    echo "ERROR: --project <KEY> or JIRA_PROJECT env required for JQL mode" >&2; exit 2
  fi
  JQL="sprint = \"${SPRINT_NAME}\" AND project = ${PROJECT_KEY} ORDER BY key ASC"
  mapfile -t SPRINT_KEYS < <(
    curl -sf -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
      "${JIRA_BASE_URL}/rest/api/3/search?jql=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "${JQL}")&maxResults=200&fields=key" \
      | jq -r '.issues[].key'
  )
  STORY_KEYS=("${SPRINT_KEYS[@]}" "${STORY_KEYS[@]}")
fi

if [[ ${#STORY_KEYS[@]} -eq 0 ]]; then
  echo "ERROR: no story keys provided. Use explicit keys or --sprint <name>" >&2
  usage >&2
  exit 2
fi

# ---------- load watchlist (if provided) ----------
declare -A WATCHLIST
if [[ -n "${WATCHLIST_PATH}" ]]; then
  while IFS= read -r line; do
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    WATCHLIST["${line}"]=1
  done < "${WATCHLIST_PATH}"
fi

# ---------- file-path extraction regex ----------
# Matches paths starting with common top-level dirs or root config files.
# Override via env FILE_REGEX / ROOT_FILES_REGEX if your project layout differs.
FILE_REGEX="${FILE_REGEX:-(backend|frontend|qa|scripts|docker|services|apps|packages|cmd|internal|pkg|src|lib|test|tests)/[A-Za-z0-9_./*-]+\.(py|ts|tsx|js|jsx|go|rs|yml|yaml|md|sh|toml|json|sql)}"
ROOT_FILES_REGEX="${ROOT_FILES_REGEX:-(docker-compose[A-Za-z0-9._-]*\.(yml|yaml)|CLAUDE\.md|AGENTS\.md|README\.md|pyproject\.toml|package\.json|go\.mod|Cargo\.toml|\.env\.example)}"

extract_paths_from_text() {
  local text="$1"
  {
    echo "${text}" | grep -oE "${FILE_REGEX}" || true
    echo "${text}" | grep -oE "${ROOT_FILES_REGEX}" || true
  } | sed 's/[,;:()"'"'"']//g' | sort -u
}

# ---------- fetch description per story ----------
fetch_jira_description() {
  local key="$1"
  local resp
  resp=$(curl -sf -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
    "${JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=summary,description")
  local summary
  summary=$(echo "${resp}" | jq -r '.fields.summary // ""')
  # Flatten ADF (Atlassian Document Format) to plain text
  local desc
  desc=$(echo "${resp}" | jq -r '[.fields.description | .. | .text? // empty] | join(" ")' 2>/dev/null || echo "")
  echo "${summary} ${desc}"
}

# ---------- build story→files map ----------
declare -A STORY_FILES  # key → space-separated file list

if [[ -n "${FIXTURE_PATH}" ]]; then
  # Offline fixture mode: TSV with STORY<TAB>file1<TAB>file2...
  if [[ ! -f "${FIXTURE_PATH}" ]]; then
    echo "ERROR: fixture not found: ${FIXTURE_PATH}" >&2
    exit 2
  fi
  declare -A FIXTURE_MAP
  while IFS=$'\t' read -r story_key rest; do
    [[ -z "${story_key}" || "${story_key}" == \#* ]] && continue
    FIXTURE_MAP["${story_key}"]="${rest}"
  done < "${FIXTURE_PATH}"

  for key in "${STORY_KEYS[@]}"; do
    if [[ -n "${FIXTURE_MAP[${key}]:-}" ]]; then
      files=$(echo "${FIXTURE_MAP[${key}]}" | tr '\t' '\n' | sort -u | tr '\n' ' ')
      STORY_FILES["${key}"]="${files}"
    else
      STORY_FILES["${key}"]=""
    fi
    if [[ ${VERBOSE} -eq 1 ]]; then
      echo "[VERBOSE] ${key} (fixture): ${STORY_FILES[${key}]}"
    fi
  done
else
  # Live Jira mode
  for var in JIRA_BASE_URL JIRA_EMAIL JIRA_API_TOKEN; do
    [[ -z "${!var:-}" ]] && { echo "ERROR: env var ${var} required for live mode" >&2; exit 2; }
  done
  for key in "${STORY_KEYS[@]}"; do
    echo "Fetching ${key}..." >&2
    text=$(fetch_jira_description "${key}")
    if [[ ${VERBOSE} -eq 1 ]]; then
      echo "[VERBOSE] ${key} raw text: ${text}" >&2
    fi
    files=$(extract_paths_from_text "${text}" | tr '\n' ' ')
    STORY_FILES["${key}"]="${files}"
  done
fi

# ---------- build file→stories collision map ----------
declare -A FILE_STORIES

for key in "${STORY_KEYS[@]}"; do
  files_str="${STORY_FILES[${key}]:-}"
  [[ -z "${files_str}" ]] && continue
  for f in ${files_str}; do
    [[ -z "${f}" ]] && continue
    if [[ -n "${FILE_STORIES[${f}]:-}" ]]; then
      if [[ " ${FILE_STORIES[${f}]} " != *" ${key} "* ]]; then
        FILE_STORIES["${f}"]="${FILE_STORIES[${f}]} ${key}"
      fi
    else
      FILE_STORIES["${f}"]="${key}"
    fi
  done
done

for wf in "${!WATCHLIST[@]}"; do
  if [[ -z "${FILE_STORIES[${wf}]:-}" ]]; then
    FILE_STORIES["${wf}"]=""
  fi
done

# ---------- output ----------
COLLISION_FOUND=0
WATCHLIST_HIT=0

declare -a COLLISION_ROWS
declare -a WATCHLIST_ROWS

for f in $(echo "${!FILE_STORIES[@]}" | tr ' ' '\n' | sort); do
  stories="${FILE_STORIES[${f}]:-}"
  story_count=$(echo "${stories}" | tr ' ' '\n' | grep -c '\S' || true)
  is_watchlist=0
  for wf in "${!WATCHLIST[@]}"; do
    if [[ "${f}" == ${wf} || "${f}" == "${wf}" ]]; then
      is_watchlist=1
      break
    fi
  done

  if [[ "${story_count}" -ge 2 ]]; then
    COLLISION_FOUND=1
    COLLISION_ROWS+=("${story_count}	${f}	${stories}")
  fi

  if [[ "${is_watchlist}" -eq 1 && "${story_count}" -ge 1 ]]; then
    WATCHLIST_HIT=1
    WATCHLIST_ROWS+=("${story_count}	${f}	${stories}")
  fi
done

align_table() {
  awk -F'\t' '
    { rows[NR]=$0; for(i=1;i<=NF;i++) if(length($i)>w[i]) w[i]=length($i) }
    END { for(r=1;r<=NR;r++) {
      n=split(rows[r],f,"\t")
      for(i=1;i<=n;i++) printf "%-*s  ", w[i], f[i]
      printf "\n"
    }}
  '
}

print_section() {
  local title="$1"; shift
  local -n rows_ref=$1
  [[ ${#rows_ref[@]} -eq 0 ]] && return
  echo
  echo "=== ${title} ==="
  echo
  {
    printf '%s\t%s\t%s\n' "COUNT" "FILE" "STORIES"
    printf '%s\t%s\t%s\n' "-----" "----" "-------"
    for row in "${rows_ref[@]}"; do
      printf '%s\n' "${row}"
    done
  } | align_table
  echo
  echo "Total: ${#rows_ref[@]} row(s)"
}

echo
echo "Sprint Shared-File Audit"
echo "Stories: ${STORY_KEYS[*]}"
echo "Watchlist: ${WATCHLIST_PATH:-<none>}"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ ${COLLISION_FOUND} -eq 0 && ${WATCHLIST_HIT} -eq 0 ]]; then
  echo "No collisions or watchlist hits detected."
  exit 0
fi

declare -a SORTED_COLLISION
if [[ ${#COLLISION_ROWS[@]} -gt 0 ]]; then
  mapfile -t SORTED_COLLISION < <(printf '%s\n' "${COLLISION_ROWS[@]}" | sort -t$'\t' -k1 -rn)
fi

declare -a SORTED_WATCHLIST
if [[ ${#WATCHLIST_ROWS[@]} -gt 0 ]]; then
  mapfile -t SORTED_WATCHLIST < <(printf '%s\n' "${WATCHLIST_ROWS[@]}" | sort -t$'\t' -k1 -rn)
fi

print_section "COLLISIONS (file touched by ≥2 stories)" SORTED_COLLISION
print_section "WATCHLIST HITS (always-shared files touched)" SORTED_WATCHLIST

echo
echo "Action: For each collision, add 'blocks'/'is blocked by' Jira links."
echo "        Earlier story (smaller key) blocks later story unless sprint order differs."
echo

exit 1
