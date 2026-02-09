# Specification Conformance Checklist (RTM v1.1)

Traceability matrix mapping requirements to implementation, tests, and status.

Last updated: 2026-02-09

## Legend

| Status | Meaning |
|--------|---------|
| PASS   | Requirement fully implemented and tested |
| PARTIAL| Partially implemented or missing edge-case tests |
| FAIL   | Not implemented or broken |

---

## Authentication & Authorization

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| AUTH-01 | Public routes accessible without auth | AGENTS.md | `src/routes/public.ts` | `protection-matrix.test.ts` | PASS | — |
| AUTH-02 | CF Access JWT validation on protected routes | AGENTS.md | `src/auth/middleware.ts` | `middleware.test.ts` | PASS | — |
| AUTH-03 | DEV_MODE bypasses CF Access | AGENTS.md | `src/auth/middleware.ts` | `middleware.test.ts`, `protection-matrix.test.ts` | PASS | — |
| AUTH-04 | E2E_TEST_MODE bypasses CF Access | AGENTS.md | `src/auth/middleware.ts` | `middleware.test.ts`, `protection-matrix.test.ts` | PASS | — |
| AUTH-05 | CDP endpoints use shared secret auth (not CF Access) | AGENTS.md | `src/routes/cdp.ts` | `cdp.test.ts`, `protection-matrix.test.ts` | PASS | — |
| AUTH-06 | DEBUG_ROUTES flag gates /debug/* | AGENTS.md | `src/index.ts` | `protection-matrix.test.ts` | PASS | — |
| AUTH-07 | JWT claims extracted (email, serviceToken) | AGENTS.md | `src/auth/jwt.ts` | `jwt.test.ts` | PASS | — |

## CDP (Chrome DevTools Protocol) Endpoints

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| CDP-01 | WS `/cdp` — primary WebSocket endpoint | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-02 | GET `/cdp/json/version` — browser version info | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-03 | GET `/cdp/json/list` — list targets | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-04 | GET `/cdp/json/new` — create new target | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-05 | GET `/cdp/json` — alias for /json/list | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-06 | WS `/cdp/devtools/browser/{id}` — standard CDP path | README.md | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-07 | Timing-safe secret comparison | Security | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-08 | 503 when CDP_SECRET not configured | Error handling | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-09 | 401 for invalid/missing secret | Error handling | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |
| CDP-10 | 503 when BROWSER binding missing | Error handling | `src/routes/cdp.ts` | `cdp.test.ts` | PASS | — |

## Admin API

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| API-01 | GET `/api/admin/devices` — list devices | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-02 | POST `/api/admin/devices/:id/approve` — approve device | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-03 | POST `/api/admin/devices/approve-all` | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-04 | GET `/api/admin/storage` — R2 status | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-05 | POST `/api/admin/storage/sync` — trigger sync | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-06 | POST `/api/admin/gateway/restart` — restart gateway | AGENTS.md | `src/routes/api.ts` | `api.test.ts` | PASS | — |
| API-07 | GET `/api/status` — public health check | AGENTS.md | `src/routes/public.ts` | `protection-matrix.test.ts` | PASS | — |

## Debug Routes

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| DBG-01 | GET `/debug/version` — moltbot + node versions | AGENTS.md | `src/routes/debug.ts` | `debug.test.ts` | PASS | — |
| DBG-02 | GET `/debug/processes` — list sandbox processes | AGENTS.md | `src/routes/debug.ts` | `debug.test.ts` | PASS | — |
| DBG-03 | GET `/debug/logs` — moltbot gateway logs | AGENTS.md | `src/routes/debug.ts` | `debug.test.ts` | PASS | — |
| DBG-04 | GET `/debug/env` — environment info | AGENTS.md | `src/routes/debug.ts` | `debug.test.ts` | PASS | — |
| DBG-05 | GET `/debug/container-config` — container settings | AGENTS.md | `src/routes/debug.ts` | `debug.test.ts` | PASS | — |

## Gateway & Environment

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| GW-01 | AI provider priority: CF Gateway > Anthropic > OpenAI > legacy | AGENTS.md | `src/gateway/env.ts` | `env.test.ts` | PASS | — |
| GW-02 | Gateway process lifecycle (find, start, wait) | AGENTS.md | `src/gateway/process.ts` | `process.test.ts` | PASS | — |
| GW-03 | R2 storage mount and sync | AGENTS.md | `src/gateway/r2.ts`, `src/gateway/sync.ts` | `r2.test.ts`, `sync.test.ts` | PASS | — |
| GW-04 | Structured logging with log levels | AGENTS.md | `src/utils/logging.ts` | `logging.test.ts` | PASS | — |

## Build & Configuration

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| BLD-01 | `npm run build` succeeds without warnings | RTM v1.1 | `vite.config.ts`, `wrangler.jsonc` | CI | PASS | — |
| BLD-02 | `npm run typecheck` passes cleanly | RTM v1.1 | `tsconfig.json` | CI | PASS | — |
| BLD-03 | `npm run lint` passes cleanly | RTM v1.1 | oxlint config | CI | PASS | — |
| BLD-04 | `npm test` — all tests green | RTM v1.1 | vitest | CI | PASS | — |
| BLD-05 | LF line endings enforced for shell scripts | RTM v1.1 | `.gitattributes` | — | PASS | — |

## Documentation

| REQ_ID | Requirement | Source | Implementation | Test | Status | Owner |
|--------|------------|--------|----------------|------|--------|-------|
| DOC-01 | AGENTS.md project tree matches src/ layout | RTM v1.1 | `AGENTS.md` | CI doc-check | PASS | — |
| DOC-02 | AGENTS.md testing section matches actual tests | RTM v1.1 | `AGENTS.md` | CI doc-check | PASS | — |
| DOC-03 | README CDP endpoints match implementation | RTM v1.1 | `README.md` | CI doc-check | PASS | — |
| DOC-04 | Admin API endpoints in checklist match implementation | RTM v1.1 | `SPEC_CONFORMANCE_CHECKLIST.md` | CI doc-check | PASS | — |

---

## Summary

| Category | PASS | PARTIAL | FAIL | Total |
|----------|------|---------|------|-------|
| Authentication | 7 | 0 | 0 | 7 |
| CDP Endpoints | 10 | 0 | 0 | 10 |
| Admin API | 7 | 0 | 0 | 7 |
| Debug Routes | 5 | 0 | 0 | 5 |
| Gateway & Env | 4 | 0 | 0 | 4 |
| Build & Config | 5 | 0 | 0 | 5 |
| Documentation | 4 | 0 | 0 | 4 |
| **Total** | **42** | **0** | **0** | **42** |
