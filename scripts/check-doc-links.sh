#!/usr/bin/env bash
# check-doc-links.sh — verify documentation consistency with codebase.
# Called from CI to prevent documentation drift.
#
# 1. Checks AGENTS.md, README.md, and SPEC_CONFORMANCE_CHECKLIST.md for src/ file
#    references and ensures they exist.
# 2. Verifies CDP endpoints in README match src/routes/cdp.ts route definitions.
# 3. Verifies Admin API endpoints in SPEC_CONFORMANCE_CHECKLIST match src/routes/api.ts.

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
check_file_refs "SPEC_CONFORMANCE_CHECKLIST.md"

# ── CDP Endpoint Consistency ──────────────────────────────────────────────────
# Verify that CDP endpoints documented in README match actual route definitions
# in src/routes/cdp.ts. This catches doc-vs-code drift after refactors.

check_cdp_endpoints() {
  local readme="README.md"
  local cdp_src="src/routes/cdp.ts"

  if [ ! -f "$readme" ] || [ ! -f "$cdp_src" ]; then
    return
  fi

  echo ""
  echo "Checking CDP endpoint consistency (README vs src/routes/cdp.ts)..."

  # Extract documented CDP endpoint paths from README table rows
  # Format: | `WS /cdp` | ... | or | `GET /cdp/json/version` | ... |
  local doc_endpoints
  doc_endpoints=$(grep -oP '`(?:GET|WS|POST|PUT|DELETE) /cdp[^`]*`' "$readme" \
    | sed 's/`//g' \
    | sed 's/^[A-Z]* //' \
    | sed 's/{[^}]*}/:id/g' \
    | sort -u || true)

  # Extract actual route paths from cdp.ts
  # cdp.get('/json/version', ...) → /cdp/json/version
  # cdp.get('/', ...) → /cdp
  local code_endpoints
  code_endpoints=$(grep -oP "cdp\.(get|post|put|delete|all)\(['\"]([^'\"]+)['\"]" "$cdp_src" \
    | sed "s/cdp\.\(get\|post\|put\|delete\|all\)(['\"]//;s/['\"]$//" \
    | while IFS= read -r path; do
        if [ "$path" = "/" ]; then
          echo "/cdp"
        else
          echo "/cdp${path}"
        fi
      done \
    | sed 's/:id/:id/g' \
    | sort -u || true)

  # Compare: every documented endpoint must be in code
  for ep in $doc_endpoints; do
    if ! echo "$code_endpoints" | grep -qxF "$ep"; then
      echo "ERROR: README documents endpoint '$ep' but it is not in $cdp_src"
      errors=$((errors + 1))
    fi
  done

  # Compare: every code endpoint must be documented
  for ep in $code_endpoints; do
    if ! echo "$doc_endpoints" | grep -qxF "$ep"; then
      echo "ERROR: $cdp_src defines endpoint '$ep' but it is not in README"
      errors=$((errors + 1))
    fi
  done

  if [ "$errors" -eq 0 ]; then
    echo "OK: CDP endpoints in README match src/routes/cdp.ts"
  fi
}

check_cdp_endpoints

# ── Admin API Endpoint Consistency ───────────────────────────────────────────
# Verify that Admin API endpoints in SPEC_CONFORMANCE_CHECKLIST match actual
# route definitions in src/routes/api.ts. Catches doc-vs-code drift.

check_admin_api_endpoints() {
  local checklist="SPEC_CONFORMANCE_CHECKLIST.md"
  local api_src="src/routes/api.ts"

  if [ ! -f "$checklist" ] || [ ! -f "$api_src" ]; then
    return
  fi

  echo ""
  echo "Checking Admin API endpoint consistency (SPEC_CONFORMANCE_CHECKLIST vs src/routes/api.ts)..."

  local pre_errors=$errors

  # Extract documented Admin API endpoint paths from checklist table rows
  # Format: | API-01 | GET `/api/admin/devices` — ... |
  # Method is outside backticks, path is inside backticks
  local doc_endpoints
  doc_endpoints=$(grep -oP '(?:GET|POST|PUT|DELETE|PATCH) `/api/admin/[^`]+`' "$checklist" \
    | sed 's/`//g' \
    | sed 's/^[A-Z]* //' \
    || true)

  # Extract actual route paths from api.ts
  # adminApi.get('/devices', ...) → /api/admin/devices
  local code_endpoints
  code_endpoints=$(grep -oP "adminApi\.(get|post|put|delete)\(['\"]([^'\"]+)['\"]" "$api_src" \
    | sed "s/adminApi\.\(get\|post\|put\|delete\)(['\"]//;s/['\"]$//" \
    | while IFS= read -r path; do
        echo "/api/admin${path}"
      done \
    || true)

  # Compare: every documented endpoint must be in code (normalized)
  for ep in $doc_endpoints; do
    # Normalize param names for comparison: :requestId → :param, :id → :param
    local ep_norm
    ep_norm=$(echo "$ep" | sed 's/:[a-zA-Z]*/:/g')
    local found=false
    for code_ep in $code_endpoints; do
      local code_norm
      code_norm=$(echo "$code_ep" | sed 's/:[a-zA-Z]*/:/g')
      if [ "$ep_norm" = "$code_norm" ]; then
        found=true
        break
      fi
    done
    if [ "$found" = "false" ]; then
      echo "ERROR: SPEC_CONFORMANCE_CHECKLIST documents endpoint '$ep' but it is not in $api_src"
      errors=$((errors + 1))
    fi
  done

  # Compare: every code endpoint must be documented
  for code_ep in $code_endpoints; do
    local code_norm
    code_norm=$(echo "$code_ep" | sed 's/:[a-zA-Z]*/:/g')
    local found=false
    for ep in $doc_endpoints; do
      local ep_norm
      ep_norm=$(echo "$ep" | sed 's/:[a-zA-Z]*/:/g')
      if [ "$code_norm" = "$ep_norm" ]; then
        found=true
        break
      fi
    done
    if [ "$found" = "false" ]; then
      echo "ERROR: $api_src defines endpoint '$code_ep' but it is not in SPEC_CONFORMANCE_CHECKLIST"
      errors=$((errors + 1))
    fi
  done

  if [ "$errors" -eq "$pre_errors" ]; then
    echo "OK: Admin API endpoints in SPEC_CONFORMANCE_CHECKLIST match src/routes/api.ts"
  fi
}

check_admin_api_endpoints

# ── Final result ─────────────────────────────────────────────────────────────

if [ "$errors" -gt 0 ]; then
  echo ""
  echo "FAIL: Found $errors issue(s) in documentation consistency check."
  echo "Please update the docs to match the actual codebase."
  exit 1
else
  echo ""
  echo "OK: All documentation consistency checks passed."
fi
