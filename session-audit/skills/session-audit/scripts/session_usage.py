#!/usr/bin/env python3
"""Usage and cost profile of Claude Code session transcripts, offline.

    S="${CLAUDE_PLUGIN_ROOT}/skills/session-audit/scripts/session_usage.py"
    python3 "$S" find <title-or-session-id>
    python3 "$S" report --run before=a.jsonl --run after=b.jsonl,c.jsonl [--agents]
    python3 "$S" report --run ... --shipped before=7,4634 --shipped after=35,19847

`--shipped NAME=<merged PRs>,<added lines>` adds the efficiency table: cost and
units per merged PR and per added line, with the gain of the last run over the
first.

A run is one or more transcripts (a resumed or forked session writes a second
file that repeats the first one's messages; they are counted once). Subagent
transcripts are read from `<session>/subagents/` beside each file.

Prices are USD per million, `--price <model-substring>=<input>,<output>`.
The defaults are assumptions: check them before quoting a dollar figure.
"""
import argparse
import collections
import glob
import json
import os
import re
import sys

DEFAULT_PRICES = {"opus": (5.0, 25.0), "sonnet": (3.0, 15.0), "haiku": (1.0, 5.0)}
WAIT_RE = re.compile(r"\bsleep\b|gh run watch|/tasks/\w+\.output")


def lines(path):
    with open(path, errors="replace") as fh:
        for raw in fh:
            try:
                yield json.loads(raw)
            except ValueError:
                continue


def cost(model, usage, prices):
    for name, (p_in, p_out) in prices.items():
        if name in (model or ""):
            break
    else:
        return 0.0
    split = usage.get("cache_creation") or {}
    w5, w1 = split.get("ephemeral_5m_input_tokens"), split.get("ephemeral_1h_input_tokens")
    if w5 is None and w1 is None:
        w5, w1 = usage.get("cache_creation_input_tokens", 0), 0
    units = (
        usage.get("input_tokens", 0) * p_in
        + (w5 or 0) * p_in * 1.25
        + (w1 or 0) * p_in * 2
        + usage.get("cache_read_input_tokens", 0) * p_in * 0.1
        + usage.get("output_tokens", 0) * p_out
    )
    return units / 1e6


def calls(path, seen):
    """API calls in one transcript, one per message id, skipping ids already seen."""
    out = {}
    for rec in lines(path):
        if rec.get("type") != "assistant":
            continue
        msg = rec.get("message") or {}
        usage, model = msg.get("usage"), msg.get("model")
        if not usage or model == "<synthetic>":
            continue
        mid = msg.get("id") or rec.get("uuid")
        if mid in seen:
            continue
        out[mid] = (model, usage, rec.get("timestamp") or "")
    seen.update(out)
    return list(out.values())


def total(rows, prices):
    agg = collections.Counter()
    for model, usage, _ in rows:
        agg["calls"] += 1
        agg["read"] += usage.get("cache_read_input_tokens", 0)
        agg["write"] += usage.get("cache_creation_input_tokens", 0)
        agg["fresh"] += usage.get("input_tokens", 0)
        agg["out"] += usage.get("output_tokens", 0)
        agg["usd"] += cost(model, usage, prices)
    return agg


def main_profile(path, done):
    """Tool mix, wait calls, dispatch prompt and receipt sizes of a top-level transcript."""
    tools, shell = collections.Counter(), collections.Counter()
    prompts, receipts, waits, agent_ids, human = [], [], 0, set(), []
    for rec in lines(path):
        content = (rec.get("message") or {}).get("content")
        if rec.get("type") == "user" and not rec.get("isMeta") and not rec.get("isSidechain"):
            texts = [content] if isinstance(content, str) else [b.get("text", "") for b in content or [] if b.get("type") == "text"]
            for text in texts:
                if "<command-name>" in text:
                    text = " ".join(re.findall(r"<command-(?:name|args)>([^<]*)<", text))
                elif text.lstrip().startswith("<"):
                    continue
                human.append((rec.get("timestamp", "")[:16], " ".join(text.split())[:160]))
        if not isinstance(content, list):
            continue
        for block in content:
            kind = block.get("type")
            if rec.get("type") == "assistant" and kind == "tool_use" and block["id"] not in done:
                done.add(block["id"])
                name, arg = block["name"], block.get("input") or {}
                tools[name] += 1
                if name == "Bash":
                    cmd = arg.get("command", "")
                    shell[" ".join(cmd.split()[:2])[:32]] += 1
                    waits += bool(WAIT_RE.search(cmd))
                elif name in ("Agent", "Task"):
                    agent_ids.add(block["id"])
                    prompts.append(len(arg.get("prompt", "")))
            elif rec.get("type") == "user" and kind == "tool_result" and block.get("tool_use_id") in agent_ids:
                receipts.append(len(json.dumps(block.get("content"))))
    return tools, shell, waits, prompts, receipts, human


def subagents(path, seen, prices):
    rows = []
    for sub in sorted(glob.glob(os.path.join(path[: -len(".jsonl")], "subagents", "*.jsonl"))):
        got = calls(sub, seen)
        if not got:
            continue
        meta = {}
        try:
            with open(sub[: -len(".jsonl")] + ".meta.json") as fh:
                meta = json.load(fh)
        except (OSError, ValueError):
            pass
        stamps = sorted(c[2] for c in got)
        model = collections.Counter(c[0] for c in got).most_common(1)[0][0]
        rows.append(
            dict(kind=meta.get("agentType", "?"), what=meta.get("description", ""), model=model,
                 start=stamps[0][:16], end=stamps[-1][:16], agg=total(got, prices))
        )
    return rows


def fmt(agg):
    return "calls=%d read=%.1fM write=%.2fM out=%dK $%.1f" % (
        agg["calls"], agg["read"] / 1e6, agg["write"] / 1e6, agg["out"] / 1e3, agg["usd"])


def report(name, paths, prices, show_agents):
    seen, done = set(), set()
    top, subs, sizes = [], [], []
    tools, shell = collections.Counter(), collections.Counter()
    waits, prompts, receipts, human = 0, [], [], []
    for path in paths:
        got = calls(path, seen)
        top += got
        sizes += [(c[2], sum(c[1].get(f, 0) for f in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))) for c in got]
        subs += subagents(path, seen, prices)
        t, s, w, p, r, h = main_profile(path, done)
        tools += t
        shell += s
        waits += w
        prompts += p
        receipts += r
        human += h
    top_agg = total(top, prices)
    sub_usd = sum(r["agg"]["usd"] for r in subs)
    all_usd = top_agg["usd"] + sub_usd
    all_tok = sum(a["read"] + a["write"] + a["fresh"] + a["out"] for a in [top_agg] + [r["agg"] for r in subs])
    stamps = sorted(s for s, _ in sizes if s)
    print("## run %s" % name)
    print("transcripts: %d   window: %s -> %s" % (len(paths), stamps[0][:16] if stamps else "?", stamps[-1][:16] if stamps else "?"))
    print("total: $%.1f   %.0fM units   top level $%.1f (%.0f%%)   subagents $%.1f" % (
        all_usd, all_tok / 1e6, top_agg["usd"], 100 * top_agg["usd"] / all_usd if all_usd else 0, sub_usd))
    print("top level: %s  model=%s" % (fmt(top_agg), collections.Counter(c[0] for c in top).most_common(1)[0][0] if top else "?"))
    if sizes:
        ordered = [n for _, n in sorted(sizes)]
        print("top-level context: first=%dK median=%dK max=%dK" % (ordered[0] / 1e3, sorted(ordered)[len(ordered) // 2] / 1e3, max(ordered) / 1e3))
    print("top-level tools: %s" % ", ".join("%s=%d" % kv for kv in tools.most_common(8)))
    print("top-level shell: %s" % ", ".join("%s=%d" % kv for kv in shell.most_common(8)))
    print("top-level wait/poll calls: %d" % waits)
    if prompts:
        print("dispatches: %d   prompt avg=%d chars   receipt avg=%d chars" % (
            len(prompts), sum(prompts) / len(prompts), sum(receipts) / len(receipts) if receipts else 0))
    print("\n| agent type | n | model | calls | read M | $ | $/dispatch |\n|---|---|---|---|---|---|---|")
    kinds = collections.defaultdict(list)
    for row in subs:
        kinds[row["kind"]].append(row)
    for kind, rows in sorted(kinds.items(), key=lambda kv: -sum(r["agg"]["usd"] for r in kv[1])):
        usd = sum(r["agg"]["usd"] for r in rows)
        print("| %s | %d | %s | %d | %.1f | %.1f | %.2f |" % (
            kind, len(rows), rows[0]["model"], sum(r["agg"]["calls"] for r in rows),
            sum(r["agg"]["read"] for r in rows) / 1e6, usd, usd / len(rows)))
    if show_agents:
        print()
        for row in sorted(subs, key=lambda r: r["start"]):
            print("%s %s  %-36s %-44s %s" % (row["start"][5:], row["end"][11:], row["kind"], row["what"][:44], fmt(row["agg"])))
    print("\nhuman turns:")
    for stamp, text in human:
        print("  %s  %s" % (stamp, text))
    print()
    return all_usd, all_tok


def efficiency(results, shipped):
    """Rows of (label, value per run..., gain first/last) for runs that have shipped work."""
    names = [n for n in results if n in shipped]
    rows = []
    for label, pick, div, scale in (
        ("Cost per merged PR ($)", 0, 0, 1), ("Cost per added line ($)", 0, 1, 1),
        ("Units per merged PR (M)", 1, 0, 1e6), ("Units per added line (K)", 1, 1, 1e3),
    ):
        vals = [results[n][pick] / shipped[n][div] / scale if shipped[n][div] else 0.0 for n in names]
        gain = vals[0] / vals[-1] if len(vals) > 1 and vals[-1] else None
        rows.append((label, vals, gain))
    return names, rows


def print_efficiency(results, shipped):
    names, rows = efficiency(results, shipped)
    if not names:
        return
    print("## efficiency")
    print("shipped: %s" % ", ".join("%s=%d PRs/%d lines" % (n, shipped[n][0], shipped[n][1]) for n in names))
    gain_col = len(names) > 1
    print("\n| measure | %s%s |" % (" | ".join(names), " | gain" if gain_col else ""))
    print("|---|%s" % ("---|" * (len(names) + gain_col)))
    for label, vals, gain in rows:
        cells = " | ".join("%.3f" % v if v < 1 else "%.1f" % v for v in vals)
        print("| %s | %s%s |" % (label, cells, " | %.1fx" % gain if gain else (" | -" if gain_col else "")))
    print()


def find(needle, root):
    hits = []
    for path in glob.glob(os.path.join(root, "*", "*.jsonl")):
        if needle in os.path.basename(path):
            hits.append((path, "id"))
            continue
        with open(path, errors="replace") as fh:
            for raw in fh:
                if '"custom-title"' in raw and '"customTitle":"%s"' % needle in raw:
                    hits.append((path, "title"))
                    break
    for path, how in sorted(hits, key=lambda h: os.path.getmtime(h[0])):
        print("%s\t%s\t%d bytes" % (path, how, os.path.getsize(path)))
    return 0 if hits else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("find")
    f.add_argument("needle")
    f.add_argument("--projects", default=os.path.expanduser("~/.claude/projects"))
    r = sub.add_parser("report")
    r.add_argument("--run", action="append", required=True, metavar="NAME=a.jsonl[,b.jsonl]")
    r.add_argument("--price", action="append", default=[], metavar="MODEL=IN,OUT")
    r.add_argument("--agents", action="store_true", help="list every subagent dispatch")
    r.add_argument("--shipped", action="append", default=[], metavar="NAME=PRS,LINES")
    args = ap.parse_args(argv)
    if args.cmd == "find":
        return find(args.needle, args.projects)
    prices = dict(DEFAULT_PRICES)
    for spec in args.price:
        model, _, pair = spec.partition("=")
        p_in, p_out = pair.split(",")
        prices[model] = (float(p_in), float(p_out))
    print("prices (USD per million, input/output): %s\n" % ", ".join("%s=%g/%g" % (m, a, b) for m, (a, b) in prices.items()))
    results = {}
    for spec in args.run:
        name, _, files = spec.partition("=")
        results[name] = report(name, files.split(","), prices, args.agents)
    shipped = {}
    for spec in args.shipped:
        name, _, pair = spec.partition("=")
        prs, added = pair.split(",")
        shipped[name] = (int(prs), int(added))
    print_efficiency(results, shipped)
    return 0


if __name__ == "__main__":
    sys.exit(main())
