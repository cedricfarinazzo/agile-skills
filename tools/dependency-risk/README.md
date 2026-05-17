# Dependency Risk Scanner

This minimal scanner detects Node and Python manifests (package.json, requirements.txt, pyproject.toml),
runs `npm audit --json` and `pip-audit -f json` when available, and writes results to
`tools/dependency-risk/results/*.json`.

Usage:
  chmod +x tools/dependency-risk/scan.sh
  tools/dependency-risk/scan.sh

Exit codes:
  0 - no high/critical issues found or no manifests
  2 - high/critical issues found

Guidance:
  - Review the produced JSON artifacts to identify affected packages and remediation (upgrade, patch, replace).
  - Use the GitHub Actions workflow `.github/workflows/dependency-risk.yml` to run scans on PRs and on a schedule.
