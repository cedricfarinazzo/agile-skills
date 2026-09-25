#!/usr/bin/env python3
"""Verify that the Jira links a merge train ANNOUNCED were actually CREATED.

Used by `agile-13-sprint-closeout` Phase 6.5. Link creation can fail quietly (network blip,
permission error, partial run): the postmortem says the link exists, the board says otherwise.

Usage
-----
    S="${CLAUDE_PLUGIN_ROOT}/skills/agile-13-sprint-closeout/scripts/audit_merge_train_links.py"

    # a comments dump + its `<dump>.links.json` sidecar (absent ⇒ every row "read failed")
    python3 "$S" --comments-json dump.json --key-prefix PROJ

Exit codes: ``0`` every announced pair verified · ``1`` at least one FAIL, or the audit could
not be performed (see "Zero is not a pass") · ``2`` usage error.

Tests: ``python3 -m pytest test_audit_merge_train_links.py`` beside this file.

Zero is not a pass
------------------
An empty expected set over a NON-EMPTY ticket set is a FAILURE: "no links announced" and "my
patterns matched nothing" are the same output. The report always states tickets read and
matches per pattern. Announcement wording varies between runs, hence :data:`PATTERNS`, a
NAMED family: a new wording adds a member, never loosens an existing one.

Offline
-------
The script reads only the two JSON files. It makes no network call and reads no credential:
the skill fetches comments and links through the Atlassian MCP and writes the files.

Stdlib only — runs from a bare interpreter.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final

__all__ = [
    "Announcement",
    "Pair",
    "PATTERNS",
    "Row",
    "build_pairs",
    "extract_announcements",
    "main",
    "render",
    "verify",
]

#: The Jira link type a merge train announces. Lower-cased everywhere compared — Jira spells
#: the TYPE `Relates` and the DIRECTION `relates to`, two spellings of one thing.
DEFAULT_LINK_TYPE: Final[str] = "relates"



@dataclass(frozen=True)
class Announcement:
    """One link a comment CLAIMS was created, and which pattern read it."""

    to_key: str
    link_type: str
    pattern: str


@dataclass(frozen=True)
class Pair:
    """An expected link, as the audit will check it."""

    from_key: str
    to_key: str
    link_type: str


@dataclass(frozen=True)
class Row:
    """One verified pair — a line of the table Phase 6.5 pastes."""

    pair: Pair
    ok: bool
    link_id: str | None
    detail: str = ""


def _key_pattern(prefix: str) -> str:
    """The issue-key regex fragment for a project prefix. Never a hardcoded project."""
    return rf"{re.escape(prefix)}-\d+"


# ── the pattern family ───────────────────────────────────────────────────────────────────────
#
# Each entry is (name, template): one `{key}` slot, compiled per run against the caller's key
# prefix, so no project name is baked in.
#
# `related_prose` is NOT applied to a whole comment: almost every postmortem mentions a sibling
# ticket somewhere, and reading a mention as an announcement would invent expected links the
# train never claimed, turning the audit into noise. Scoped to the `### Related` section, where
# the train puts its claim.
PATTERNS: Final[tuple[tuple[str, str], ...]] = (
    # `Jira link created: relates to PROJ-123.` — the merge train's documented announcement.
    ("skill_bare", r"Jira link created:\s*relates to\s+({key})"),
    # Same with the run suffix — the postmortem's own variant. Also matched by the
    # pattern above (suffix follows the key); kept as its own NAMED member so a report can say
    # which shape a project actually emits, rather than collapsing them.
    (
        "skill_suffixed",
        r"Jira link created:\s*relates to\s+({key})\s*\(Phase\s*4[^)]*\)",
    ),
    # ``PROJ-123 (`Relates`)`` inside a `### Related` section — the prose form a train has
    # emitted instead of the documented line. Section scoping applied by the extractor.
    ("related_prose", r"({key})\s*\(`?Relates`?\)"),
)

#: Patterns that only make sense inside a `### Related` heading's section.
_SECTION_SCOPED: Final[frozenset[str]] = frozenset({"related_prose"})

_RELATED_SECTION = re.compile(
    r"^#{1,6}\s*Related\b(?P<body>.*?)(?=^#{1,6}\s|\Z)",
    re.MULTILINE | re.DOTALL | re.IGNORECASE,
)


def _related_sections(body: str) -> str:
    """Every `### Related` section's text, concatenated. Empty when there is none."""
    return "\n".join(m.group("body") for m in _RELATED_SECTION.finditer(body))


def extract_announcements(body: str, *, key_prefix: str) -> list[Announcement]:
    """Every link this comment CLAIMS was created.

    Deduplicated on `(to_key, link_type)`: two patterns matching one sentence (which
    `skill_bare`/`skill_suffixed` do by construction) is one announcement, not two. Winning
    pattern's NAME kept for the report, first match by :data:`PATTERNS` order, so the
    diagnostic stays stable across runs.
    """
    seen: dict[tuple[str, str], Announcement] = {}
    scoped = _related_sections(body)
    for name, template in PATTERNS:
        haystack = scoped if name in _SECTION_SCOPED else body
        if not haystack:
            continue
        regex = re.compile(template.format(key=_key_pattern(key_prefix)))
        for match in regex.finditer(haystack):
            found = Announcement(to_key=match.group(1), link_type=DEFAULT_LINK_TYPE, pattern=name)
            seen.setdefault((found.to_key, found.link_type), found)
    return list(seen.values())


def build_pairs(comments_by_key: Mapping[str, Sequence[str]], *, key_prefix: str) -> list[Pair]:
    """`(from_key, to_key, link_type)` triples across every ticket's comments.

    Self-announcements dropped — a ticket naming itself is prose, not a link, and Jira can't
    store one anyway. Duplicates collapse: the train confirms on BOTH sides, so one link
    announced twice would otherwise be audited as two.
    """
    pairs: dict[tuple[str, str, str], Pair] = {}
    for from_key, bodies in comments_by_key.items():
        for body in bodies:
            for found in extract_announcements(body, key_prefix=key_prefix):
                if found.to_key == from_key:
                    continue
                pair = Pair(from_key, found.to_key, found.link_type)
                pairs.setdefault((pair.from_key, pair.to_key, pair.link_type), pair)
    return sorted(pairs.values(), key=lambda p: (p.from_key, p.to_key, p.link_type))


def _link_matches(link: Mapping, pair: Pair) -> bool:
    """Whether one `issuelinks` entry is the pair's link, IN EITHER DIRECTION.

    Direction is an artefact of which side created the link, not a real difference — `Relates`
    stored outbound on A and inbound on B are the same fact. Checking only one direction would
    report half a healthy graph as broken.
    """
    if str((link.get("type") or {}).get("name", "")).lower() != pair.link_type.lower():
        return False
    other = link.get("outwardIssue") or link.get("inwardIssue") or {}
    return other.get("key") == pair.to_key


def verify(pairs: Iterable[Pair], reader: Callable[[str], Sequence[Mapping]]) -> list[Row]:
    """Check each pair against `reader(from_key)`'s `issuelinks`.

    `reader` is injected, not called directly, so every assertion here is provable with no
    network and no credentials — what makes direction-insensitivity testable at all.

    A raising reader is reported as a FAIL carrying the reason, never swallowed: an unreachable
    Jira and a missing link must not produce the same row.
    """
    rows: list[Row] = []
    for pair in pairs:
        try:
            links = reader(pair.from_key)
        except Exception as exc:  # noqa: BLE001 — the reason belongs in the row, not a traceback
            rows.append(Row(pair, ok=False, link_id=None, detail=f"read failed: {exc}"))
            continue
        hit = next((link for link in links if _link_matches(link, pair)), None)
        rows.append(
            Row(
                pair,
                ok=hit is not None,
                link_id=str(hit.get("id")) if hit else None,
                detail="" if hit else "announced but not found",
            )
        )
    return rows


def render(rows: Sequence[Row], *, examined: Mapping[str, int]) -> str:
    """The table Phase 6.5 pastes, with what was EXAMINED beside what was found.

    Zero rows read the same whether nothing was announced or the patterns went stale; the
    `examined` counts tell the two apart.
    """
    header = f"{'from':<12} | {'to':<12} | {'type':<10} | {'status':<6} | link_id"
    lines = [header, "-" * len(header)]
    for row in rows:
        lines.append(
            f"{row.pair.from_key:<12} | {row.pair.to_key:<12} | "
            f"{row.pair.link_type:<10} | {'PASS' if row.ok else 'FAIL':<6} | "
            f"{row.link_id or '-'}" + (f"   ({row.detail})" if row.detail else "")
        )
    passed = sum(1 for r in rows if r.ok)
    failed = len(rows) - passed
    lines.append("-" * len(header))
    lines.append(f"total: {len(rows)} pair(s) — {passed} PASS, {failed} FAIL")
    per_pattern = ", ".join(f"{k}={v}" for k, v in sorted(examined.items()) if k != "tickets")
    lines.append(
        f"examined: {examined.get('tickets', 0)} ticket(s); "
        f"announcements matched: {per_pattern or 'none'}"
    )
    return "\n".join(lines)


def _pattern_counts(
    comments_by_key: Mapping[str, Sequence[str]], *, key_prefix: str
) -> dict[str, int]:
    counts = {name: 0 for name, _ in PATTERNS}
    for bodies in comments_by_key.values():
        for body in bodies:
            for found in extract_announcements(body, key_prefix=key_prefix):
                counts[found.pattern] += 1
    counts["tickets"] = len(comments_by_key)
    return counts


# ── entry point ──────────────────────────────────────────────────────────────────────────────


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="audit_merge_train_links.py", description=__doc__.split("\n\n")[1]
    )
    parser.add_argument(
        "--comments-json",
        required=True,
        help="a JSON object mapping issue key -> list of comment bodies",
    )
    parser.add_argument("--key-prefix", default="", help="issue-key prefix, e.g. PROJ")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    if not args.key_prefix:
        print(
            "--key-prefix is required — this script is not bound to any one project.",
            file=sys.stderr,
        )
        return 2

    with open(args.comments_json, encoding="utf-8") as handle:
        comments_by_key: dict[str, list[str]] = json.load(handle)
    # A dump may carry links too, under a sibling `.links.json`. When it does NOT, the
    # reader RAISES rather than answering "no links" — those are different facts, and
    # conflating them is the exact shape `verify`'s docstring forbids ("an unreachable
    # Jira and a missing link must not produce the same row"). Without the raise, every
    # pair reports `announced but not found` — asserting MISSING when nothing was
    # checked, the worst case here since a clean offline run would accuse a healthy board.
    sidecar = os.path.splitext(args.comments_json)[0] + ".links.json"
    links_by_key: dict[str, list] = {}
    if os.path.exists(sidecar):
        with open(sidecar, encoding="utf-8") as handle:
            links_by_key = json.load(handle)

        def reader(key: str) -> Sequence[Mapping]:
            return links_by_key.get(key, [])
    else:

        def reader(key: str) -> Sequence[Mapping]:
            raise FileNotFoundError(
                f"no link data: {sidecar} does not exist. A comments dump proves what was "
                "ANNOUNCED; verifying what Jira HAS needs the links too — supply the sidecar."
            )

    pairs = build_pairs(comments_by_key, key_prefix=args.key_prefix)
    examined = _pattern_counts(comments_by_key, key_prefix=args.key_prefix)

    if not pairs and comments_by_key:
        # THE anti-vacuity gate (see "Zero is not a pass" above): never a silent 0. This is the
        # shape a stale pattern family takes, indistinguishable from a healthy sprint by every
        # other signal this script produces.
        print(
            f"NO announcements matched across {len(comments_by_key)} ticket(s).\n"
            "This is reported as a FAILURE rather than a pass: an empty expected set and a "
            "sprint that announced nothing are the same output, and only one of them means "
            "the audit ran. Check whether the merge train's wording has changed — if it has, "
            "add a NAMED member to PATTERNS rather than loosening an existing one.",
            file=sys.stderr,
        )
        return 1

    rows = verify(pairs, reader)
    print(render(rows, examined=examined))
    return 0 if all(row.ok for row in rows) else 1


if __name__ == "__main__":  # pragma: no cover — exercised via main() in the unit tests
    sys.exit(main())
