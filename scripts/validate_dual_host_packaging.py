#!/usr/bin/env python3
"""Validate Claude Code, Codex, and portable plugin packaging stay aligned."""

import json
import pathlib
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(path):
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"{path}: {error}") from error


def fail(message):
    print(f"FAIL: {message}", file=sys.stderr)
    return 1


def main():
    claude_marketplace = load(ROOT / ".claude-plugin/marketplace.json")
    codex_marketplace = load(ROOT / ".agents/plugins/marketplace.json")
    claude = {entry["name"]: entry for entry in claude_marketplace["plugins"]}
    codex = {entry["name"]: entry for entry in codex_marketplace["plugins"]}
    failures = 0

    if set(claude) != set(codex):
        failures += fail(
            "marketplaces differ: "
            f"Claude-only={sorted(set(claude) - set(codex))}; "
            f"Codex-only={sorted(set(codex) - set(claude))}"
        )

    for package in sorted(set(claude) | set(codex)):
        root = ROOT / package
        expected_source = f"./{package}"
        if not root.is_dir():
            failures += fail(f"{package}: package directory missing")
            continue
        if package in claude and claude[package].get("source") != expected_source:
            failures += fail(f"{package}: Claude marketplace source is not {expected_source}")
        if package in codex and codex[package].get("source", {}).get("path") != expected_source:
            failures += fail(f"{package}: Codex marketplace source is not {expected_source}")

        paths = [
            root / ".claude-plugin/plugin.json",
            root / ".codex-plugin/plugin.json",
            root / "plugin.json",
        ]
        if not all(path.is_file() for path in paths):
            failures += fail(f"{package}: missing Claude, Codex, or portable manifest")
            continue
        manifests = [load(path) for path in paths]
        if {manifest.get("name") for manifest in manifests} != {package}:
            failures += fail(f"{package}: manifest names differ")
        if len({manifest.get("version") for manifest in manifests}) != 1:
            failures += fail(f"{package}: manifest versions differ")
        if manifests[1].get("skills") != "./skills/":
            failures += fail(f"{package}: Codex skills path must be ./skills/")
        if package in {"agile-execution", "agile-merge-review", "agile-sprint-drain"} and "Subagents" in manifests[1].get("interface", {}).get("capabilities", []):
            failures += fail(f"{package}: Codex is inline-only and must not advertise Subagents")
        if manifests[2].get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
            failures += fail(f"{package}: portable manifest has the wrong schema")

    if failures:
        return 1
    print(f"PASS: {len(claude)} packages have aligned Claude, Codex, and portable packaging")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
