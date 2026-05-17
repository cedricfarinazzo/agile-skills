#!/usr/bin/env python3
"""Normalize 'Triggers:' inline phrases into frontmatter 'when_to_use' YAML sequence for SKILL.md files.

This implementation avoids external YAML dependencies by performing a targeted
textual transformation of the frontmatter: it extracts inline 'Triggers:'
from the description block or top-level 'Triggers' key and inserts/updates a
'when_to_use' YAML list. It preserves unrelated frontmatter lines.
"""
from __future__ import annotations
import argparse
import glob
import os
import re
import sys
from typing import List, Tuple, Optional

SEPARATOR_RE = re.compile(r"[;,|]")
TRIGGERS_LINE_RE = re.compile(r"(?mi)^\s*Triggers\s*:\s*(.*)$")
TRIGGERS_INLINE_RE = re.compile(r'(?i)Triggers\s*:\s*(.*?)(?=(?:[.?!]\s+[A-Z0-9"\'\(]|$))')


def normalize_items(items: List[str]) -> List[str]:
    seen = {}
    out = []
    for it in items:
        parts = SEPARATOR_RE.split(it)
        for p in parts:
            v = p.strip().lower()
            v = v.strip(" .-–—")
            if not v:
                continue
            if v not in seen:
                seen[v] = True
                out.append(v)
    return out


def split_frontmatter(text: str) -> Tuple[str, str]:
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if m:
        return m.group(1), m.group(2)
    return "", text


def join_frontmatter(fm_block: str, body: str) -> str:
    if fm_block:
        # preserve original frontmatter/body spacing to keep idempotency
        return "---\n" + fm_block + "\n---\n" + body
    return body


def extract_when_to_use_from_fm_lines(lines: List[str]) -> Tuple[List[str], List[str]]:
    """Return (items, lines_without_when_to_use)"""
    out = []
    i = 0
    n = len(lines)
    skip_range = None
    while i < n:
        line = lines[i]
        m = re.match(r"^\s*when_to_use\s*:\s*(.*)$", line)
        if m:
            val = m.group(1).strip()
            # if inline scalar
            if val and not val.startswith("|") and not val.startswith("["):
                out.append(val.strip('"'))
                skip_range = (i, i)
                i += 1
                break
            # otherwise it's a block/list: collect subsequent indented list lines
            j = i + 1
            while j < n and re.match(r"^\s+[-].*$", lines[j]):
                mm = re.match(r"^\s*[-]\s*(.*)$", lines[j])
                if mm:
                    out.append(mm.group(1).strip())
                j += 1
            skip_range = (i, j - 1)
            break
        i += 1
    if skip_range is None:
        return out, lines
    s, e = skip_range
    new_lines = lines[:s] + lines[e + 1 :]
    return out, new_lines


def extract_triggers_from_description_block(lines: List[str]) -> Tuple[List[str], List[str]]:
    out = []
    new_lines = lines[:]
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        m = re.match(r"^\s*description\s*:\s*(.*)$", line)
        if m:
            val = m.group(1).rstrip()
            if val == "|" or val == ">":
                # block style: collect following indented lines
                j = i + 1
                block_lines = []
                while j < n and (lines[j].startswith(" ") or lines[j].strip() == ""):
                    block_lines.append(lines[j])
                    j += 1
                if block_lines:
                    # compute min indent
                    min_indent = None
                    for bl in block_lines:
                        stripped = bl.lstrip('\t ')
                        if stripped:
                            indent = len(bl) - len(stripped)
                            if min_indent is None or indent < min_indent:
                                min_indent = indent
                    if min_indent is None:
                        min_indent = 0
                    content_lines = [bl[min_indent:] for bl in block_lines]
                    # find Triggers: lines (anywhere in content lines)
                    kept = []
                    for cl in content_lines:
                        tm = TRIGGERS_INLINE_RE.search(cl)
                        if tm:
                            v = tm.group(1).strip()
                            if v:
                                out.append(v)
                        else:
                            kept.append(cl)
                    # reconstruct block lines with two-space indent
                    ind = '  '
                    new_block = [ind + ln for ln in kept]
                    new_lines = new_lines[:i] + [line] + new_block + new_lines[j:]
                i = j
                continue
            else:
                # inline description: check for Triggers: anywhere in the line
                tm = TRIGGERS_INLINE_RE.search(line)
                if tm:
                    v = tm.group(1).strip()
                    if v:
                        out.append(v)
                    # remove triggers fragment from line
                    new_line = TRIGGERS_INLINE_RE.sub('', line)
                    # collapse accidental duplicate punctuation introduced by removal
                    new_line = re.sub(r'\.\s*\.', '.', new_line)
                    new_line = re.sub(r'\s{2,}', ' ', new_line).rstrip()
                    new_lines[i] = new_line
        i += 1
    return out, new_lines


def extract_triggers_from_fm_block(fm_block: str) -> Tuple[List[str], str]:
    if not fm_block:
        return [], fm_block
    lines = fm_block.splitlines()
    # 1) extract from top-level 'Triggers:' key
    tvals = []
    new_lines = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        m = re.match(r"^\s*Triggers\s*:\s*(.*)$", line)
        if m:
            val = m.group(1).strip()
            if val:
                tvals.append(val)
            i += 1
            continue
        new_lines.append(line)
        i += 1
    lines = new_lines
    # 2) extract from description block
    found_desc, lines = extract_triggers_from_description_block(lines)
    tvals.extend(found_desc)
    return tvals, '\n'.join(lines) + ('\n' if fm_block.endswith('\n') else '')


def insert_or_replace_when_to_use(fm_block: str, items: List[str]) -> str:
    if not items:
        return fm_block
    lines = fm_block.splitlines()
    # remove existing when_to_use if present
    _, lines = extract_when_to_use_from_fm_lines(lines)
    # prefer to insert after 'name:' if present
    insert_at = 0
    for i, line in enumerate(lines):
        if re.match(r"^\s*name\s*:\s*", line):
            insert_at = i + 1
            break
    # build when_to_use block
    block = ['when_to_use:']
    for it in items:
        block.append(f"  - {it}")
    new_lines = lines[:insert_at] + block + lines[insert_at:]
    return '\n'.join(new_lines) + ('\n' if fm_block.endswith('\n') else '')


def extract_triggers_from_body(body: str) -> Tuple[List[str], str]:
    found = []
    new_body_lines = []
    for line in body.splitlines():
        m = TRIGGERS_LINE_RE.match(line)
        if m:
            v = m.group(1).strip()
            if v:
                found.append(v)
        else:
            new_body_lines.append(line)
    body_ret = '\n'.join(new_body_lines)
    if body.endswith('\n'):
        body_ret += '\n'
    return found, body_ret


def process_file(path: str, apply: bool = False) -> Tuple[bool, str, str]:
    orig = open(path, 'r', encoding='utf-8').read()
    fm_block, body = split_frontmatter(orig)
    fm_triggers, fm_block_no_triggers = extract_triggers_from_fm_block(fm_block)
    body_triggers, new_body = extract_triggers_from_body(body)
    all_found = fm_triggers + body_triggers

    normalized = normalize_items(all_found)

    existing = []
    if fm_block_no_triggers:
        ex, _ = extract_when_to_use_from_fm_lines(fm_block_no_triggers.splitlines())
        existing = [e.strip().lower() for e in ex if e]

    combined = []
    seen = set()
    for it in existing + normalized:
        if not it:
            continue
        if it not in seen:
            seen.add(it)
            combined.append(it)

    new_fm = fm_block_no_triggers
    if combined:
        new_fm = insert_or_replace_when_to_use(new_fm, combined)

    new_content = join_frontmatter(new_fm, new_body)
    changed = new_content != orig
    if changed and apply:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    return changed, orig, new_content


def find_files(patterns: List[str]) -> List[str]:
    files = []
    if not patterns:
        patterns = ['skills/**/SKILL.md']
    for p in patterns:
        files.extend(sorted(glob.glob(p, recursive=True)))
    out = []
    for f in files:
        if f not in out:
            out.append(f)
    return out


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--dry-run', action='store_true', default=False)
    group.add_argument('--apply', action='store_true', default=False)
    parser.add_argument('files', nargs='*')
    args = parser.parse_args(argv)

    files = find_files(args.files or [])
    if not files:
        print('No SKILL.md files found', file=sys.stderr)
        return 1

    any_changed = False
    for path in files:
        try:
            changed, orig, new = process_file(path, apply=args.apply)
        except Exception as e:
            print(f'Error processing {path}: {e}', file=sys.stderr)
            continue
        if changed:
            any_changed = True
            if args.dry_run:
                import difflib
                diff = difflib.unified_diff(orig.splitlines(keepends=True), new.splitlines(keepends=True), fromfile=path+' (orig)', tofile=path+' (new)')
                sys.stdout.writelines(diff)
            else:
                print('Updated:', path)
    if any_changed:
        return 0
    print('No changes needed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
