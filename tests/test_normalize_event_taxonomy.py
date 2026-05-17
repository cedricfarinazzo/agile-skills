import os
import sys
import tempfile
import textwrap
from subprocess import run, PIPE

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SCRIPT = os.path.join(REPO_ROOT, 'scripts', 'normalize_event_taxonomy.py')

sample = textwrap.dedent('''\
---
name: test-skill
description: |
  This is a test skill.
  Triggers: Alpha, Beta;Gamma | delta
---

# Skill body

Some text.
Triggers: epsilon, alpha
''')


def test_dry_run_creates_when_to_use():
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, 'SKILL.md')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(sample)
        # run script in dry-run mode
        p = run([sys.executable, SCRIPT, '--dry-run', path], stdout=PIPE, stderr=PIPE, cwd=REPO_ROOT, text=True)
        out = p.stdout
        assert 'when_to_use' in out or 'when_to_use' in p.stderr
        # expected normalized tokens
        assert 'alpha' in out.lower()
        assert 'beta' in out.lower()
        assert 'gamma' in out.lower()


if __name__ == '__main__':
    test_dry_run_creates_when_to_use()
    print('ok')
