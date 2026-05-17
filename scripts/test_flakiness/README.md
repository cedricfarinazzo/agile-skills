Test Flakiness Analyzer

Usage

1. Run the test runner N times (default 5):
   ./scripts/test_flakiness/run_tests.sh -n 5 -c "<TEST_CMD>"

2. Analyze results:
   python3 scripts/test_flakiness/analyze_results.py

Outputs

- tmp/test_flake_runs/ : per-run outputs (run_1.xml, run_1.txt, run_1.exit ...)
- scripts/test_flakiness/test-flake-report.json : JSON report with per-test flakiness

Configuration

- N: number of runs. Default 5.
- TEST_CMD: the canonical test command for the repository. If not provided, the runner will try to heuristically detect a command (npm test, pytest, go test, mvn test).

CI Integration

- Add a job that executes the runner and analyzer and uploads test-flake-report.json as an artifact.

Notes

- This analyzer prefers JUnit XML output (pytest with --junitxml). If the project test runner does not emit structured output, the analyzer falls back to suite-level analysis using exit codes or simple keyword scanning of logs.
- The tool is intentionally minimal and language-agnostic. Improve parsing for specific frameworks by extending analyze_results.py to recognize framework-specific outputs.
