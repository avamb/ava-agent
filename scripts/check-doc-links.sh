#!/usr/bin/env bash
# check-doc-links.sh — verify that file paths referenced in docs actually exist.
# Called from CI to prevent documentation drift.
#
# Checks AGENTS.md and README.md for src/ file references and ensures they exist.

set -euo pipefail

errors=0

check_file_refs() {
  local doc="$1"
  if [ ! -f "$doc" ]; then
    return
  fi

  # Extract src/ paths from markdown (e.g. `src/foo/bar.ts`, src/foo/bar.ts)
  # Matches patterns like: src/something.ext or src/dir/something.ext
  local refs
  refs=$(grep -oP '(?<=`|[ (])src/[a-zA-Z0-9_./-]+\.[a-zA-Z]+' "$doc" | sort -u || true)

  for ref in $refs; do
    # Skip wildcard patterns (e.g. src/routes/*.test.ts)
    if [[ "$ref" == *"*"* ]]; then
      continue
    fi
    if [ ! -f "$ref" ]; then
      echo "ERROR: $doc references '$ref' but file does not exist"
      errors=$((errors + 1))
    fi
  done
}

echo "Checking documentation file references..."
check_file_refs "AGENTS.md"
check_file_refs "README.md"

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "FAIL: Found $errors broken file reference(s) in documentation."
  echo "Please update the docs to match the actual codebase."
  exit 1
else
  echo "OK: All documented file references are valid."
fi
