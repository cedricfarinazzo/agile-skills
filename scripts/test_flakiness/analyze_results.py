#!/usr/bin/env python3
"""
Simple flakiness analyzer.
Parses JUnit XML if present, else falls back to per-run exit codes (suite-level).
Emits test-flake-report.json and prints a short summary.
"""
import os
import glob
import json
import xml.etree.ElementTree as ET
from collections import defaultdict

OUT_DIR = "tmp/test_flake_runs"
REPORT_PATH = "scripts/test_flakiness/test-flake-report.json"

def parse_junit(xml_files):
    tests = defaultdict(lambda: {"name": "", "runs": 0, "failures": 0, "fail_messages": []})
    runs = 0
    for xf in sorted(xml_files):
        runs += 1
        try:
            tree = ET.parse(xf)
            root = tree.getroot()
            # handle <testsuite> containing <testcase>
            for tc in root.findall('.//testcase'):
                name = tc.get('name') or ''
                classname = tc.get('classname') or ''
                tid = f"{classname}.{name}" if classname else name
                rec = tests[tid]
                rec['name'] = tid
                rec['runs'] += 1
                # failure or error child
                if tc.find('failure') is not None or tc.find('error') is not None:
                    rec['failures'] += 1
                    # capture message/text
                    failure = tc.find('failure') or tc.find('error')
                    msg = (failure.get('message') or '') + '\n' + (failure.text or '')
                    rec['fail_messages'].append(msg.strip())
        except Exception as e:
            print(f"Failed parsing {xf}: {e}")
    return tests, runs


def parse_exits(exit_files):
    # Fallback: treat whole-suite as single test
    tests = {}
    runs = 0
    for ef in sorted(exit_files):
        runs += 1
        try:
            with open(ef) as f:
                rc = int(f.read().strip() or '0')
        except Exception:
            rc = 1
        tid = "__suite__"
        if tid not in tests:
            tests[tid] = {"name": tid, "runs": 0, "failures": 0, "fail_messages": []}
        tests[tid]['runs'] += 1
        if rc != 0:
            tests[tid]['failures'] += 1
            tests[tid]['fail_messages'].append(f"run {ef} rc={rc}")
    return tests, runs


def main():
    xml_files = glob.glob(os.path.join(OUT_DIR, 'run_*.xml'))
    exit_files = glob.glob(os.path.join(OUT_DIR, 'run_*.exit'))
    txt_files = glob.glob(os.path.join(OUT_DIR, 'run_*.txt'))

    report = {"tests": {}, "summary": {}}

    if xml_files:
        tests, runs = parse_junit(xml_files)
    elif exit_files:
        tests, runs = parse_exits(exit_files)
    else:
        # no structured output; try grepping txt logs for FAIL lines per-run
        # fallback to suite-level using txt presence
        if txt_files:
            # if any txt contains non-zero exit, try to infer
            # look for 'FAILED' or 'FAIL' lines
            tests = {}
            runs = len(txt_files)
            tid = '__suite__'
            tests[tid] = {"name": tid, "runs": runs, "failures": 0, "fail_messages": []}
            for tf in sorted(txt_files):
                with open(tf, errors='ignore') as f:
                    content = f.read()
                    if 'FAILED' in content or '\nFAIL' in content or 'ERROR' in content:
                        tests[tid]['failures'] += 1
                        tests[tid]['fail_messages'].append(f"{tf}: contains failure keywords")
        else:
            print(f"No test run outputs found in {OUT_DIR}")
            return

    # compute flakiness
    total_tests = 0
    flaky = 0
    for tid, rec in tests.items():
        total_tests += 1
        runs = rec.get('runs', 0) or runs
        failures = rec.get('failures', 0)
        score = failures / runs if runs else 0.0
        rec['flakiness'] = score
        rec['runs_observed'] = runs
        if failures > 0 and failures < runs:
            rec['flaky'] = True
            flaky += 1
        else:
            rec['flaky'] = False
        report['tests'][tid] = rec

    report['summary'] = {
        'total_tests': total_tests,
        'runs_per_test': runs,
        'flaky_tests': flaky,
    }

    # write JSON
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, 'w') as out:
        json.dump(report, out, indent=2)

    # print a short human summary
    print('Test flakiness analysis complete')
    print(json.dumps(report['summary'], indent=2))
    print(f"Report written to: {REPORT_PATH}")

if __name__ == '__main__':
    main()
