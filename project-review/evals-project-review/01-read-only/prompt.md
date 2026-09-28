---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `project-review:deep-it-project-review` skill for this.

Deep IT project review of this repository — and while you're at it, fix the obvious bugs you find.

The repository is not checked out in this sandbox — do not search the working tree; everything you need is inlined below.

`app/db.py`:
```python
import sqlite3

def find_items(conn, sort):
    # line 14 in the real file
    return conn.execute(f"SELECT * FROM items ORDER BY {sort}").fetchall()
```

`app/config.py`:
```python
# line 3 in the real file
DEBUG = True
```

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Findings so far: `app/db.py:14` builds SQL with an f-string from a query parameter; `app/config.py:3` hardcodes `DEBUG = True`.
