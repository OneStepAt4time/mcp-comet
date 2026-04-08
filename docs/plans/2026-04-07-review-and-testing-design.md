---
date: 2026-04-07
title: Comprehensive Review & Testing Plan
status: approved
approach: Bottom-Up (Unit -> Integration -> UAT -> CI)
---

# Asteria Comprehensive Review & Testing Plan

## Goal

Full audit, risk mapping, and production gate for the Asteria MCP server.
Approach: Bottom-Up — each phase gates the next.

## Phase 1: Unit Test Gap Fill

**Gate**: Every `src/` file has at least one test covering its exports.

### P0 — Critical Untested Modules

| Module | What to Test |
|--------|-------------|
| `src/cli.ts` | `printUsage()`, `printVersion()`, `runDetect()`, `runCall()`, `main()` — command parsing, unknown command, invalid JSON |
| `src/cdp/client.ts` | `connect()`, `disconnect()`, `navigate()`, `screenshot()`, `evaluate()`, `safeEvaluate()`, `pressKey()`, `isHealthy()`, `ensureHealthyConnection()`, `withAutoReconnect()`, `reconnect()`, `listTabsCategorized()`, `launchOrConnect()`, `closeExtraTabs()`, `pickBestTarget()` |
| `src/server.ts` inline scripts | Extract `comet_stop` and `comet_list_conversations` inline scripts to `src/ui/` as testable functions, then unit test them |

### P1 — Edge Case Gaps

| Module | Missing Edge Cases |
|--------|-------------------|
| `src/cdp/browser.ts` | `isWSL()`, `httpGet()` timeout/errors, `isCometProcessRunning()`, `killComet()`, `startCometProcess()` |
| `src/config.ts` | Malformed JSON config, invalid env var values, unknown config keys |
| `src/cdp/connection.ts` | `isConnectionError()` with non-Error inputs, `getBackoffDelay` with edge values |
| `src/ui/navigation.ts` | `buildModeSwitchScript` with unknown modes, `buildSubmitPromptScript` timeout |
| `src/ui/status.ts` | `buildGetAgentStatusScript` with custom selectors, status logic, response truncation |
| `src/prose-filter.ts` | `buildPreSendStateScript` wrapper |

### P2 — Lower Priority

- `src/snapshot.ts` — `runSnapshot()` with mocked CDPClient
- `src/selectors/v145.ts` — verify selector strings are valid CSS
- `src/version.ts` — `detectCometVersion` with invalid JSON, timeout

## Phase 2: Integration Tests

**Gate**: All 12 tool handlers have at least one mock-based integration test (happy path + one error path).

### Mock-Based Integration Tests

| Tool | Test Scenarios |
|------|---------------|
| `comet_connect` | Happy path connect, launch new browser, close extra tabs, version detection |
| `comet_ask` | Happy path response, timeout with partial response, newChat=true, polling loop |
| `comet_poll` | Returns status JSON, handles evaluation errors |
| `comet_stop` | Stop button found, no stop button found |
| `comet_screenshot` | PNG and JPEG formats |
| `comet_mode` | Get current mode, switch mode, unknown mode |
| `comet_list_tabs` | Categorized tabs output |
| `comet_switch_tab` | Switch by tabId, switch by title, not found |
| `comet_get_sources` | Sources found, no sources |
| `comet_list_conversations` | Conversations found, none found |
| `comet_open_conversation` | Valid URL, invalid URL rejection |
| `comet_get_page_content` | With default and custom maxLength |

### Real Browser Integration (optional, requires Comet running)

- Connect to real Comet instance
- Send a real query via `comet_ask`
- Verify response comes back
- Test reconnection after Comet restart

## Phase 3: UAT Plan Formalization

**Gate**: UAT plan document reviewed and approved with clear pass/fail criteria for every test case.

### UAT Categories

1. **Smoke tests** (5 min) — `comet_connect`, `comet_ask`, `comet_poll`, `comet_screenshot`
2. **Functional tests** (20 min) — All 12 tools through their paces
3. **Error recovery** (10 min) — Comet restart, timeout, invalid inputs
4. **Mode switching** (5 min) — All 7 modes
5. **Cross-session** (5 min) — Multiple queries, conversation history

### Test Case Format

| Field | Description |
|-------|-------------|
| Test ID | e.g., `UAT-001` |
| Tool | Which MCP tool |
| Preconditions | What must be true before testing |
| Steps | Numbered, specific actions |
| Expected Result | Exact pass criteria |
| Actual Result | (filled during testing) |
| Pass/Fail | (filled during testing) |

## Phase 4: CI/CD Hardening

**Gate**: CI runs full test suite with coverage reporting and enforces thresholds.

### Actions

1. Add vitest coverage config — target 80% statements, 70% branches
2. Update CI workflow — add coverage step, fail on threshold breach
3. Add coverage badge to README
4. Add `test:ci` script with coverage + junit reporter
5. Gate PRs on passing tests + coverage thresholds
