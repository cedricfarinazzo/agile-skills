#!/usr/bin/env python3
"""Validate shared package identity and versions; Claude is authoritative."""
import json
from pathlib import Path
import sys


CLAUDE_ONLY = {"agile-mods"}


def check(root):
    errors = []

    def read(path):
        try:
            return json.loads((root / path).read_text())
        except (OSError, ValueError) as exc:
            errors.append(f"{path}: {exc}")
            return {}

    def entries(path):
        result = {}
        for entry in read(path).get("plugins", []):
            name = entry.get("name")
            if not isinstance(name, str) or not name or Path(name).name != name or name in {".", ".."}:
                errors.append(f"{path}: invalid package name {name!r}")
                continue
            if name in result:
                errors.append(f"{path}: duplicate package {name}")
            result[name] = entry
        if not result:
            errors.append(f"{path}: no packages")
        return result

    claude = entries(Path(".claude-plugin/marketplace.json"))
    codex = entries(Path(".agents/plugins/marketplace.json"))
    expected = set(claude) - CLAUDE_ONLY
    if set(codex) != expected:
        errors.append(f"Codex marketplace: missing {sorted(expected - set(codex))}; unexpected {sorted(set(codex) - expected)}")
    packages = {p.parent.parent.name for p in root.glob("*/.claude-plugin/plugin.json")}
    if packages != set(claude):
        errors.append("Claude marketplace must list exactly the root packages with Claude manifests")
    for name, entry in claude.items():
        if entry.get("source") != f"./{name}":
            errors.append(f"{name}: Claude source must be ./{name}")
        canonical = read(Path(name) / ".claude-plugin/plugin.json")
        if canonical.get("name") != name or not canonical.get("version"):
            errors.append(f"{name}: Claude manifest name/version invalid")
        if name in CLAUDE_ONLY:
            if (root / name / ".codex-plugin/plugin.json").exists() or (root / name / "plugin.json").exists():
                errors.append(f"{name}: Claude-only package must not ship Codex/portable manifests")
            continue
        if codex.get(name, {}).get("source") != {"source": "local", "path": f"./{name}"}:
            errors.append(f"{name}: Codex source must point to root package ./{name}")
        for relative in (".codex-plugin/plugin.json", "plugin.json"):
            manifest = read(Path(name) / relative)
            for field in ("name", "version"):
                if manifest.get(field) != canonical.get(field):
                    errors.append(f"{name}/{relative}: {field}={manifest.get(field)!r}; expected {canonical.get(field)!r}")
            if relative.startswith(".codex") and manifest.get("skills") != "./skills/":
                errors.append(f"{name}/{relative}: skills must be ./skills/")
        if not list((root / name).glob("skills/*/SKILL.md")):
            errors.append(f"{name}: no shared skills found")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[2])
    for failure in failures:
        print(f"ERROR: {failure}", file=sys.stderr)
    if failures:
        sys.exit(1)
    print("Package parity passed: marketplace membership, names, versions, and skill sources")
