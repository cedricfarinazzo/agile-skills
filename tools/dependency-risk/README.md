# Dependency Risk Scanner

Usage: ./tools/dependency-risk/scan.sh

This script looks for common dependency manifests (package.json, requirements.txt) and runs a basic check when possible. Results are written to tools/dependency-risk/results/summary.json. The scanner exits with status 1 when vulnerabilities are detected (when using npm audit).
