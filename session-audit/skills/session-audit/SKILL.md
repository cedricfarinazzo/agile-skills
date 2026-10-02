---
name: session-audit
description: "Audit the cost and efficiency of Claude Code sessions that ran agile-skills: per-skill and per-subagent spend, a before/after delta normalised by work shipped, and ranked skill improvements. Triggers: audit this session's cost, analyze the session transcripts, compare before and after sessions, is the new version more efficient, where do the tokens go, subagent cost breakdown, find efficiency improvements."
user-invocable: true
---

# session-audit

Answers two questions from session transcripts: **does the run work**, and **does it ship more work for less spend** than another run. Then names where the remaining waste is and which skill or agent edit removes it.

Read-only: it reads transcripts, the plugin source and the consumer repo's `gh` history. It edits no skill unless the user asks afterwards.

**Input:** one run to profile, or two to compare (before / after). A run is a session title, a session id, or transcript paths; one run may span several transcripts. Ask once for whatever is missing.

## 1. Locate the runs and what changed between them

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/session-audit/scripts/session_usage.py"
python3 "$S" find <title-or-session-id>          # exact title or id → transcript paths
```

Two transcripts under one title are one run (a resume or fork); the script counts their shared messages once.

For a comparison, read the plugin history between the two runs (`git log` of the skills source when it is available) and the `human turns` the report prints. **A run is rarely a clean sample**: a mid-run instruction, a plugin reload or a model switch splits it into segments. Find those from the human turns and the dispatch timeline (`--agents`), and say which segment is which.

## 2. Measure spend

```bash
python3 "$S" report --run before=<a.jsonl> --run after=<b.jsonl>,<c.jsonl> [--agents] [--price opus=<in>,<out>]
```

Per run it prints total spend, the top-level share, top-level context growth, tool and shell mix, wait/poll calls, dispatch prompt and receipt sizes, a per-agent-type table, and the human turns.

- Default prices are assumptions. Confirm current prices or state them as assumed; ratios between runs hold either way.
- Transcripts under-record output; cache reads dominate, so compare on total units and cost, never on output alone.

## 3. Measure work shipped

Spend means nothing until divided by output. From the consumer repo, over each run's window:

```bash
gh pr list --state all --limit 100 --search "created:>=<date>" \
  --json number,state,additions,deletions,changedFiles,createdAt,mergedAt,title
```

Count merged PRs and added lines per run. Leave out throwaway PRs closed unmerged and name any outlier (a generated fixture, a vendored file) excluded from the line count. No `gh` → use tickets moved to Done in the window and say the measure is coarser.

## 4. Normalise and compare

Report cost and units **per merged PR and per added line**. When PR sizes differ between runs, the per-line figure is the fair one; give both and say which you lead with. Give the cost gain and the unit gain separately: a model-tier change lowers cost without lowering units.

## 5. Check that it still works

Cheaper is only a win if the gates held. Sample at least two transcripts of whichever agent got cheaper or moved down a tier, and read what it did, not its receipt: did the review read the changed files, were the reviewed-sha and CI gates run, was a follow-up filed. Then check base-branch CI after the run's merges. State what you did not attribute rather than implying a clean result.

## 6. Find the waste

Rank by cost, and back each with a number from the report:

- **Top-level share and context growth.** Every top-level call re-reads its whole context: calls × median context is the bill. Look at `wait/poll calls`, the shell mix, and first → max context.
- **Wait loops.** A `sleep` loop or a short wait re-issued on expiry wakes the session many times per CI run.
- **Work done in the wrong context.** Diagnosis, log reading or review performed at the top level instead of in a short-lived agent.
- **Prompt and receipt size.** Standing rules restated in every dispatch; receipts longer than the orchestrator needs.
- **Cold re-reads.** Per-phase agents each re-reading the same ticket, plan and files: high `$/dispatch` on agents whose own work is small.
- **Tier against the downstream check.** An expensive tier on a phase something re-reads, or a cheap tier on a phase nothing re-reads.
- **Tool-grant gaps.** A workaround in a transcript (a raw `curl`, a credential read from the environment) means a read tool is missing from that agent's grant.

Every finding names the skill or agent file to change and a rough saving.

## Report

Verdict first, in one line. Then the comparison table (PRs merged, lines added, total cost, cost per PR, cost per line, units per PR, units per line, top-level share), where the saving came from, problems ranked by cost, and proposed edits. Close with the caveats that bound the claim: mixed segments, assumed prices, anything not verified.

Keep the report generic enough to share: counts and ratios, not ticket text or customer content.

End with `✅ Done / ⚠️ Still needed / 👉 Next step`.
