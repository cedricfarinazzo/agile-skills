import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import session_usage as su


def msg(mid, model="claude-opus-x", read=1000, out=10, content=None, ts="2026-01-01T00:00:00Z"):
    usage = {"input_tokens": 1, "output_tokens": out, "cache_read_input_tokens": read, "cache_creation_input_tokens": 0}
    return {"type": "assistant", "timestamp": ts, "message": {"id": mid, "model": model, "usage": usage, "content": content or []}}


def write(path, records):
    with open(path, "w") as fh:
        for rec in records:
            fh.write(json.dumps(rec) + "\n")


def test_streamed_chunks_count_once(tmp_path):
    p = tmp_path / "s.jsonl"
    write(p, [msg("m1"), msg("m1"), msg("m2")])
    assert len(su.calls(str(p), set())) == 2


def test_resumed_transcript_is_not_double_counted(tmp_path):
    a, b = tmp_path / "a.jsonl", tmp_path / "b.jsonl"
    write(a, [msg("m1")])
    write(b, [msg("m1"), msg("m2")])
    seen = set()
    assert len(su.calls(str(a), seen)) + len(su.calls(str(b), seen)) == 2


def test_cost_uses_cache_read_rate_and_ignores_unknown_models():
    usage = {"cache_read_input_tokens": 1_000_000}
    assert su.cost("claude-opus-x", usage, su.DEFAULT_PRICES) == 0.5
    assert su.cost("mystery", usage, su.DEFAULT_PRICES) == 0.0


def test_subagents_and_profile(tmp_path, capsys):
    p = tmp_path / "s.jsonl"
    use = [
        {"type": "tool_use", "id": "t1", "name": "Agent", "input": {"prompt": "x" * 40}},
        {"type": "tool_use", "id": "t2", "name": "Bash", "input": {"command": "for i in 1 2; do sleep 30; done"}},
    ]
    result = {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": "t1", "content": "ok"}]}}
    write(p, [msg("m1", content=use), result])
    sub = tmp_path / "s" / "subagents"
    sub.mkdir(parents=True)
    write(sub / "agent-a.jsonl", [msg("a1", model="claude-sonnet-x")])
    (sub / "agent-a.meta.json").write_text(json.dumps({"agentType": "p:worker", "description": "do"}))
    rows = su.subagents(str(p), set(), su.DEFAULT_PRICES)
    assert rows[0]["kind"] == "p:worker" and rows[0]["agg"]["calls"] == 1
    tools, _, waits, prompts, receipts, _ = su.main_profile(str(p), set())
    assert tools["Agent"] == 1 and waits == 1 and prompts == [40] and len(receipts) == 1
    su.report("r", [str(p)], su.DEFAULT_PRICES, True)
    assert "p:worker" in capsys.readouterr().out
