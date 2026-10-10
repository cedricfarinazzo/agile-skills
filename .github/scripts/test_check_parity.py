"""Regression tests exercise a valid fixture and independently broken releases."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("parity", Path(__file__).with_name("check-parity.py"))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


class ParityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write(".claude-plugin/marketplace.json", {"plugins": [
            {"name": name, "source": f"./{name}"} for name in ("sample", "agile-mods")
        ]})
        self.entry = {"name": "sample", "source": {"source": "local", "path": "./sample"}}
        self.write(".agents/plugins/marketplace.json", {"plugins": [self.entry]})
        for name in ("sample", "agile-mods"):
            self.write(f"{name}/.claude-plugin/plugin.json", {"name": name, "version": "1.0.0"})
        self.write("sample/.codex-plugin/plugin.json", {"name": "sample", "version": "1.0.0", "skills": "./skills/"})
        self.write("sample/plugin.json", {"name": "sample", "version": "1.0.0"})
        skill = self.root / "sample/skills/example/SKILL.md"
        skill.parent.mkdir(parents=True)
        skill.write_text("---\nname: example\n---\n")

    def write(self, path, data):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(data))

    def test_claude_only_exception(self):
        self.assertEqual(parity.check(self.root), [])

    def test_each_manifest_version_drift(self):
        for path in ("sample/plugin.json", "sample/.codex-plugin/plugin.json"):
            with self.subTest(path=path):
                original = json.loads((self.root / path).read_text())
                self.write(path, {**original, "version": "0.9.0"})
                self.assertTrue(any(f"{path}: version=" in e for e in parity.check(self.root)))
                self.write(path, original)

    def test_missing_manifest(self):
        (self.root / "sample/plugin.json").unlink()
        self.assertTrue(parity.check(self.root))

    def test_wrong_name_and_skill_source(self):
        self.write("sample/.codex-plugin/plugin.json", {"name": "wrong", "version": "1.0.0", "skills": "./elsewhere/"})
        errors = parity.check(self.root)
        self.assertTrue(any("name=" in e for e in errors))
        self.assertTrue(any("skills must" in e for e in errors))

    def test_marketplace_membership_source_and_duplicates(self):
        for entries in ([], [self.entry, self.entry], [{**self.entry, "source": {"source": "local", "path": "../sample"}}], [self.entry, {"name": "agile-mods"}]):
            with self.subTest(entries=entries):
                self.write(".agents/plugins/marketplace.json", {"plugins": entries})
                self.assertTrue(parity.check(self.root))


if __name__ == "__main__":
    unittest.main()
