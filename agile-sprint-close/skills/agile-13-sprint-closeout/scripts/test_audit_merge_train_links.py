"""Unit tests for `audit_merge_train_links.py` (beside this file).

Run: `python3 -m pytest agile-sprint-close/skills/agile-13-sprint-closeout/scripts/`.
Imported by path, not subprocessed; CLI exit codes run through `main(argv)` in-process.
Comment bodies are real shapes: two from the merge train's documented format, one from the
prose form a train has emitted instead.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import sys

import pytest

_SCRIPT = pathlib.Path(__file__).resolve().parent / "audit_merge_train_links.py"


def _load():
    spec = importlib.util.spec_from_file_location("_merge_train_link_audit", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


audit = _load()

PREFIX = "PROJ"

# ── real announcement shapes ──

BARE = "Jira link created: relates to PROJ-123."
SUFFIXED = "Jira link created: relates to PROJ-123 (Phase 4, merge-train run 2026-08-24)."
PROSE = (
    "### Related\n\n"
    "PROJ-123 (`Relates`) is where the failure surfaced; its own postmortem records the\n"
    "phase-shift contribution. The push-flake sibling PROJ-999 is separate and still open.\n"
)


def _links(*entries):
    """`issuelinks` as Jira returns them."""
    return list(entries)


def _outward(key: str, name: str = "Relates", link_id: str = "1"):
    return {"id": link_id, "type": {"name": name}, "outwardIssue": {"key": key}}


def _inward(key: str, name: str = "Relates", link_id: str = "2"):
    return {"id": link_id, "type": {"name": name}, "inwardIssue": {"key": key}}


# ── the expected set is sourced from the postmortems ──


@pytest.mark.parametrize(
    ("pattern_name", "body"),
    [("skill_bare", BARE), ("skill_suffixed", SUFFIXED), ("related_prose", PROSE)],
)
def test_each_named_pattern_extracts_its_own_shape(pattern_name, body):
    """Parametrized over NAMES so a dropped pattern fails by name."""
    found = audit.extract_announcements(body, key_prefix=PREFIX)
    assert [a.to_key for a in found] == ["PROJ-123"]
    assert found[0].link_type == "relates"
    assert pattern_name in {name for name, _ in audit.PATTERNS}


def test_the_prose_pattern_is_scoped_to_its_related_section():
    """A key in a `### Related` section is an announcement; the same key elsewhere in
    the comment is not. Without scoping, a postmortem merely MENTIONING a sibling mints an
    expected link never claimed — noise nobody reads, worse than no audit.
    """
    outside = "## Collisions\n\nPROJ-777 (`Relates`) was rebased first.\n\n" + PROSE
    found = {a.to_key for a in audit.extract_announcements(outside, key_prefix=PREFIX)}
    assert found == {"PROJ-123"}, "a key outside the Related section must not be announced"


def test_a_mere_mention_of_a_key_is_not_an_announcement():
    body = "### Related\n\nSee PROJ-456 for the sibling flake; it is separate and still open.\n"
    assert audit.extract_announcements(body, key_prefix=PREFIX) == []


def test_two_patterns_matching_one_sentence_are_ONE_announcement():
    """`skill_bare` also matches a suffixed sentence, by construction — one link."""
    found = audit.extract_announcements(SUFFIXED, key_prefix=PREFIX)
    assert len(found) == 1


def test_pairs_are_built_across_tickets_and_deduped():
    """The train appends its confirmation to BOTH sides — one link announced twice."""
    pairs = audit.build_pairs(
        {"PROJ-100": [BARE], "PROJ-123": ["Jira link created: relates to PROJ-100."]},
        key_prefix=PREFIX,
    )
    assert [(p.from_key, p.to_key) for p in pairs] == [
        ("PROJ-100", "PROJ-123"),
        ("PROJ-123", "PROJ-100"),
    ]


def test_a_self_announcement_is_dropped():
    """A ticket naming itself is prose; Jira can't store a self-link anyway."""
    assert audit.build_pairs({"PROJ-123": [BARE]}, key_prefix=PREFIX) == []


def test_the_key_prefix_is_honoured_so_a_foreign_project_is_not_read():
    body = "Jira link created: relates to OPS-9."
    assert audit.extract_announcements(body, key_prefix="PROJ") == []
    assert len(audit.extract_announcements(body, key_prefix="OPS")) == 1


# ── verified in EITHER direction ──


def test_an_outward_link_counts():
    pair = audit.Pair("PROJ-100", "PROJ-123", "relates")
    rows = audit.verify([pair], lambda _k: _links(_outward("PROJ-123")))
    assert rows[0].ok is True
    assert rows[0].link_id == "1"


def test_an_INWARD_link_counts_too():
    """Direction is an artefact of which side created it: counting only `outwardIssue`
    reddens this while the outward test stays green."""
    pair = audit.Pair("PROJ-100", "PROJ-123", "relates")
    rows = audit.verify([pair], lambda _k: _links(_inward("PROJ-123")))
    assert rows[0].ok is True
    assert rows[0].link_id == "2"


def test_a_link_of_the_WRONG_type_does_not_count():
    """A `Blocks` link between the same two tickets is a different fact."""
    pair = audit.Pair("PROJ-100", "PROJ-123", "relates")
    rows = audit.verify([pair], lambda _k: _links(_outward("PROJ-123", name="Blocks")))
    assert rows[0].ok is False


def test_a_link_to_a_DIFFERENT_ticket_does_not_count():
    """Anti-vacuity control — without it, a verifier returning PASS on ANY link at all
    would satisfy every positive case above."""
    pair = audit.Pair("PROJ-100", "PROJ-123", "relates")
    rows = audit.verify([pair], lambda _k: _links(_outward("PROJ-999")))
    assert rows[0].ok is False


def test_a_missing_link_is_a_FAIL_naming_why():
    pair = audit.Pair("PROJ-100", "PROJ-123", "relates")
    rows = audit.verify([pair], lambda _k: [])
    assert rows[0].ok is False
    assert "announced but not found" in rows[0].detail


def test_a_reader_that_RAISES_is_a_fail_carrying_the_reason():
    """An unreachable Jira and a missing link must not produce the same row — one is a
    broken audit, the other the finding the audit exists for."""

    def _boom(_key):
        raise RuntimeError("403 Forbidden")

    rows = audit.verify([audit.Pair("PROJ-100", "PROJ-123", "relates")], _boom)
    assert rows[0].ok is False
    assert "403 Forbidden" in rows[0].detail
    assert "announced but not found" not in rows[0].detail


# ── the table Phase 6.5 pastes ──


def _rendered(rows, examined=None):
    return audit.render(rows, examined=examined or {"tickets": 2, "skill_bare": 1})


def test_the_header_names_the_five_columns_in_order():
    out = _rendered([])
    header = out.splitlines()[0]
    assert [c.strip() for c in header.split("|")] == [
        "from",
        "to",
        "type",
        "status",
        "link_id",
    ]


def test_every_row_carries_PASS_or_FAIL_and_its_link_id():
    rows = [
        audit.Row(audit.Pair("PROJ-100", "PROJ-123", "relates"), ok=True, link_id="77"),
        audit.Row(
            audit.Pair("PROJ-200", "PROJ-201", "relates"),
            ok=False,
            link_id=None,
            detail="announced but not found",
        ),
    ]
    out = _rendered(rows)
    assert "PROJ-100" in out and "PASS" in out and "77" in out
    assert "PROJ-200" in out and "FAIL" in out


def test_the_total_line_counts_BOTH_outcomes():
    rows = [
        audit.Row(audit.Pair("PROJ-1", "PROJ-2", "relates"), ok=True, link_id="1"),
        audit.Row(audit.Pair("PROJ-3", "PROJ-4", "relates"), ok=False, link_id=None),
    ]
    assert "total: 2 pair(s) — 1 PASS, 1 FAIL" in _rendered(rows)


def test_the_report_states_what_it_EXAMINED_beside_what_it_found():
    """Zero rows read identically whether nothing was announced or the patterns went stale."""
    out = audit.render([], examined={"tickets": 27, "skill_bare": 0, "related_prose": 23})
    assert "examined: 27 ticket(s)" in out
    assert "related_prose=23" in out
    assert "skill_bare=0" in out, "a counted zero must be printed, not omitted"


# ── a FAIL exits non-zero, asserted on the EXIT CODE ──


def _run(tmp_path, comments, links=None, argv_extra=()):
    dump = tmp_path / "dump.json"
    dump.write_text(json.dumps(comments), encoding="utf-8")
    if links is not None:
        (tmp_path / "dump.links.json").write_text(json.dumps(links), encoding="utf-8")
    return audit.main(["--comments-json", str(dump), "--key-prefix", PREFIX, *argv_extra])


def test_an_all_PASS_run_exits_ZERO(tmp_path):
    code = _run(
        tmp_path,
        {"PROJ-100": [BARE]},
        links={"PROJ-100": _links(_outward("PROJ-123"))},
    )
    assert code == 0


def test_a_FAIL_exits_NON_ZERO(tmp_path):
    """Asserted on the return value, never stdout: a closeout reads `$?`, not output."""
    code = _run(tmp_path, {"PROJ-100": [BARE]}, links={"PROJ-100": []})
    assert code == 1


def test_zero_announcements_over_a_NON_EMPTY_ticket_set_FAILS(tmp_path, capsys):
    """Anti-vacuity gate: "nothing announced" and "patterns matched nothing" are the same
    output; passing the second lets the audit die silently when the train rewords."""
    code = _run(tmp_path, {"PROJ-100": ["a postmortem that announces nothing"]})
    assert code == 1
    assert "NO announcements matched" in capsys.readouterr().err


def test_an_EMPTY_ticket_set_is_not_forced_to_fail(tmp_path):
    """Complement, so the gate is about a stale parser, not emptiness — nothing to read
    means nothing to claim, a FAIL there would be noise."""
    assert _run(tmp_path, {}) == 0


def test_a_missing_key_prefix_is_a_usage_error(tmp_path, monkeypatch):
    monkeypatch.delenv("JIRA_PROJECT_KEY", raising=False)
    dump = tmp_path / "dump.json"
    dump.write_text("{}", encoding="utf-8")
    assert audit.main(["--comments-json", str(dump)]) == 2


# ── no project literal, no credential literal ──

_SOURCE = _SCRIPT.read_text(encoding="utf-8")


def test_the_source_hardcodes_no_project_key():
    """Scan is over CODE, not docstrings, so prose may quote example keys."""
    import ast
    import re

    tree = ast.parse(_SOURCE)

    # a docstring is the FIRST statement of module/class/function body — only those four
    # node types carry one, so the set is built by identity, not by asking every node
    docstring_nodes = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        first = node.body[0] if node.body else None
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            docstring_nodes.add(id(first.value))

    key_shaped = re.compile(r"\b[A-Z]{2,}-\d+\b")
    offenders = [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, str)
        and id(node) not in docstring_nodes
        and key_shaped.search(node.value)
    ]
    assert offenders == [], f"a project-scoped key is hardcoded: {offenders}"


def test_the_key_prefix_comes_from_the_argument_or_the_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("JIRA_PROJECT_KEY", "OPS")
    dump = tmp_path / "dump.json"
    dump.write_text(
        json.dumps({"OPS-1": ["Jira link created: relates to OPS-2."]}), encoding="utf-8"
    )
    (tmp_path / "dump.links.json").write_text(
        json.dumps({"OPS-1": _links(_outward("OPS-2"))}), encoding="utf-8"
    )
    assert audit.main(["--comments-json", str(dump)]) == 0


def test_the_source_carries_no_credential_literal():
    for marker in ("password", "api_token=", "Bearer ey", "ATATT"):
        assert marker not in _SOURCE, f"a credential-shaped literal is present: {marker!r}"
    assert "JIRA_API_TOKEN" in _SOURCE, "the token must be read from the environment"


def test_a_missing_token_fails_LOUDLY_rather_than_running_unauthenticated(monkeypatch):
    """An unauthenticated read returns 401s reported as missing links — every pair FAILs
    for the wrong reason, sending the operator to create links that exist."""
    monkeypatch.delenv("JIRA_EMAIL", raising=False)
    monkeypatch.delenv("JIRA_API_TOKEN", raising=False)
    with pytest.raises(SystemExit) as err:
        audit._auth_header()
    assert "JIRA_API_TOKEN" in str(err.value)


# ── the patterns are grounded in real sources, not invented ──


def test_every_pattern_is_named_and_the_names_are_distinct():
    names = [name for name, _ in audit.PATTERNS]
    assert len(names) == len(set(names))
    assert all(name and name.islower() for name in names)


def test_the_prose_shape_is_covered_because_the_documented_literal_is_not_always_emitted():
    """A real train announced mutual `Relates` links only in prose, never with
    `Jira link created:`; dropping `related_prose` empties the expected set for such runs."""
    assert "related_prose" in {name for name, _ in audit.PATTERNS}
    assert audit.extract_announcements(PROSE, key_prefix=PREFIX), (
        "the prose shape a merge train actually emits must be parseable"
    )


# --- offline dump without link data ---


def test_a_comments_dump_with_NO_link_data_says_so_instead_of_accusing_the_board(tmp_path, capsys):
    """Offline, with no `.links.json` sidecar, every row must read "read failed", not
    "announced but not found" — different facts this script exists to keep apart. The reader
    used to answer `[]` for every key, so a healthy board came back as FAILs claiming missing
    links, an accusation from having checked nothing.

    Exit code is 1 either way, so it can't tell the two apart — assert on what the OPERATOR
    reads, since they act on it.
    """
    dump = tmp_path / "comments.json"
    dump.write_text(
        json.dumps({"PROJ-1": ["Jira link created: relates to PROJ-2"]}), encoding="utf-8"
    )

    code = audit.main(["--comments-json", str(dump), "--key-prefix", "PROJ"])
    out = capsys.readouterr().out

    assert code == 1
    assert "read failed" in out
    assert "no link data" in out
    assert "announced but not found" not in out, (
        "nothing was checked, so nothing may be reported as missing"
    )


def test_the_sidecar_path_still_VERIFIES_rather_than_raising(tmp_path, capsys):
    """Complement — without it, a reader that always raises would pass the test above. A
    real sidecar carrying the announced link must PASS, proving the raise is about ABSENT
    link data, not the offline mode itself.
    """
    dump = tmp_path / "comments.json"
    dump.write_text(
        json.dumps({"PROJ-1": ["Jira link created: relates to PROJ-2"]}), encoding="utf-8"
    )
    (tmp_path / "comments.links.json").write_text(
        json.dumps(
            {
                "PROJ-1": [
                    {"id": "9001", "type": {"name": "Relates"}, "outwardIssue": {"key": "PROJ-2"}}
                ]
            }
        ),
        encoding="utf-8",
    )

    code = audit.main(["--comments-json", str(dump), "--key-prefix", "PROJ"])
    out = capsys.readouterr().out

    assert code == 0
    assert "PASS" in out and "9001" in out
