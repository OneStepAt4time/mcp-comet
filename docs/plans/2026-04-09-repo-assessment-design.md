# Asteria Repository Assessment - Complete Report

**Date:** 2026-04-09
**Scope:** Full repository assessment (architecture, code quality, test coverage, security, documentation)
**Version assessed:** 0.1.0 (commit 663a7c2)

---

## 1. Project Overview

**Asteria** is an MCP server that bridges AI agents with Perplexity Comet via Chrome DevTools Protocol (CDP). TypeScript, Node 18+, 24 source files, ~2,100 LOC, 12 MCP tools.

| Metric | Value |
|---|---|
| Source files | 24 |
| Test files | 26 (unit + integration) |
| LOC (src/) | ~2,100 |
| Dependencies (prod) | 3 |
| MCP tools | 12 |
| Coverage target | 75% statements, 70% branches |
| License | MIT |

**Strengths:**
- Clean 3-layer architecture (MCP Tools -> UI Automation -> CDP Transport)
- Well-designed error hierarchy (8 subclasses + `toMcpError`)
- Strong test coverage: 22/24 files with unit tests, all 12 tools with integration tests
- Serious security hardening (SSRF prevention, injection-safe JS embedding)
- Zero heavy browser dependencies (no Puppeteer/Playwright)
- Minimal dependencies (3 prod, 6 dev), all up-to-date

---

## 2. File-by-File Assessment

### 2.1 CDP Layer

#### `src/cdp/browser.ts` (125 lines) - Severity: MEDIUM

**Purpose:** Platform-specific Comet browser detection, launching, and process management (macOS, Windows, WSL).

**Key exports:** `getCometPath()`, `httpGet()`, `isCometProcessRunning()`, `killComet()`, `startCometProcess()`, `isWindows()`, `isMac()`, `isWSL()`.

**Issues:**
1. **`getCometPath()` uses `execSync` for file existence checks on macOS** (line 52). Should use `statSync`/`existsSync` for efficiency and correctness.
2. **`killComet()` kills ALL Comet processes** via `pkill -f 'Comet.app'`, not just the one launched by Asteria. No PID tracking exists.
3. **`startCometProcess()` spawns a detached child** (lines 117-124). If the parent crashes, the Comet process is orphaned without cleanup.
4. **`httpGet()` implements manual timeout** with `setTimeout` + `destroy()`. Could use `AbortController` for cleaner async cancellation.

**Tests:** `tests/unit/cdp/browser.test.ts` (239 lines) - good coverage, but some tests call real `httpbin.org` which may cause CI flakiness.

---

#### `src/cdp/client.ts` (341 lines) - Severity: MEDIUM

**Purpose:** Singleton CDP client wrapping `chrome-remote-interface`. Manages connections, operations queue, health checks, auto-reconnect, screenshots, and evaluation.

**Key exports:** `CDPClient` class.

**Issues:**
1. **Singleton pattern with `instance = undefined!`** (line 52) uses non-null assertion. Works but not elegant. `resetInstance()` exposed for testing is a code smell of test/implementation coupling.
2. **`evaluate()` casts response as `Promise<EvaluateResult>`** (line 189) without runtime validation of the CRI response shape. Malformed CDP responses could produce unexpected behavior downstream.
3. **Operation queue uses promise-chain pattern** (lines 28-38). If `fn()` throws, the next queued operation still runs because `resolve()` is in the `finally` block. This is correct behavior but subtle.

**Tests:** `tests/unit/cdp/client.test.ts` (572 lines) - comprehensive. Covers singleton, connect, disconnect, navigate, screenshot, evaluate, pressKey, isHealthy, operation queue serialization, reconnect race conditions, withAutoReconnect retry/throw behavior, ensureHealthyConnection, and error propagation. The largest test file.

---

#### `src/cdp/connection.ts` (29 lines) - Severity: LOW

**Purpose:** Connection error detection (pattern matching) and exponential backoff calculation.

**Key exports:** `isConnectionError()`, `getBackoffDelay()`, `CDPConnectionState` interface.

**Issues:**
1. **`isConnectionError` relies on string pattern matching** in error messages. Fragile if the underlying library changes its error message format.

**Tests:** `tests/unit/cdp/connection.test.ts` (82 lines) - good coverage.

---

#### `src/cdp/tabs.ts` (40 lines) - Severity: NONE

**Purpose:** Categorizes browser tabs into roles (main, sidecar, agentBrowsing, overlay, others) based on URL patterns.

**Key exports:** `categorizeTabs()`.

**Issues:** None. Case-insensitive URL classification, clean logic.

**Tests:** `tests/unit/cdp/tabs.test.ts` (66 lines) - covers all categories.

---

### 2.2 UI Automation Layer

#### `src/ui/status.ts` (60 lines) - Severity: HIGH

**Purpose:** Builds JS script to detect agent status (idle/working/completed), extract steps, and capture response text.

**Key exports:** `buildGetAgentStatusScript(selectors?)`.

**Issues:**
1. **Status detection via regex on `body.innerText`** (`workingPatterns`, `stepPatterns`). Extremely fragile and locale-dependent. If Comet changes button text or adds languages, detection breaks completely.
2. **Response truncation at 8000 chars** (line 48) is hardcoded. Should be configurable.
3. **This is the single most fragile component** in the codebase. Comet UI changes will break this first.

**Tests:** `tests/unit/ui/status.test.ts` (66 lines) - covers status fields, working patterns, step extraction, stop button detection, custom selectors, response truncation.

---

#### `src/ui/navigation.ts` (87 lines) - Severity: HIGH

**Purpose:** Builds JS scripts for submitting prompts, switching modes, detecting current mode, and starting new chats.

**Key exports:** `buildSubmitPromptScript()`, `buildModeSwitchScript(mode)`, `buildNewChatScript()`, `buildGetCurrentModeScript()`.

**Issues:**
1. **`buildModeSwitchScript` uses `setTimeout(tryClickMenuItem, 100)` in a polling loop inside an IIFE** (lines 43-67). Since this is evaluated via `Runtime.evaluate` with `awaitPromise: true`, the `setTimeout` callbacks will **never execute** within the evaluation context. The mode switch likely relies on the synchronous check at invocation time and **may not work reliably**. This is potentially a production bug.
2. Mode detection depends on button text matching, which is locale-dependent.

**Tests:** `tests/unit/ui/navigation.test.ts` (106 lines) - covers submit, getCurrentMode, modeSwitch for all modes, injection safety, edge cases. However, tests validate the script string structure, not the runtime behavior of `setTimeout` within CDP evaluation.

---

#### `src/ui/input.ts` (55 lines) - Severity: LOW

**Purpose:** Builds JS scripts for typing prompts into contenteditable elements and textarea/input fields, with injection-safe embedding via `JSON.stringify`.

**Key exports:** `buildTypePromptScript(prompt, selectors?)`, `buildFindInputScript(selectors?)`.

**Issues:**
1. **Uses `document.execCommand('insertText', ...)`** which is deprecated but still necessary for contenteditable React inputs. Acceptable trade-off.

**Good patterns:** U+2028/U+2029 escape handling (lines 8-9) shows attention to edge cases.

**Tests:** `tests/unit/ui/input.test.ts` (46 lines) - covers quote escaping, newline escaping, execCommand usage, backtick injection, template literal injection, unicode line separator handling.

---

#### `src/ui/extraction.ts` (65 lines) - Severity: MEDIUM

**Purpose:** Builds JS IIFE scripts for extracting sources/citations and page content.

**Key exports:** `buildExtractSourcesScript()`, `buildExtractPageContentScript(maxLength)`.

**Issues:**
1. **`buildExtractPageContentScript` strips UI noise via regex** (line 60), which is fragile. The regex only handles text at the start of lines.

**Tests:** `tests/unit/ui/extraction.test.ts` (90 lines) - covers structure, filtering, deduplication, edge cases.

---

#### `src/ui/conversations.ts` (21 lines) - Severity: MEDIUM

**Purpose:** Builds JS IIFE script to extract conversation links from the page.

**Key exports:** `buildListConversationsScript()`.

**Issues:**
1. **`getAttribute('href')` returns relative URLs** (e.g., `/search/abc123`). The `url` field in results contains relative paths, not absolute URLs. Consumers must reconstruct the full URL.

**Tests:** `tests/unit/ui/conversations.test.ts` (56 lines) - covers IIFE structure, anchor selection, URL filtering, deduplication, title extraction.

---

#### `src/ui/stop.ts` (15 lines) - Severity: LOW

**Purpose:** Builds JS script to click the stop/cancel button.

**Key exports:** `buildStopAgentScript()`.

**Issues:**
1. **SVG rect heuristic** (line 10) for detecting stop buttons could match any button with an SVG rectangle child.

**Tests:** `tests/unit/ui/stop.test.ts` (49 lines).

---

#### `src/ui/selectors.ts` (23 lines) - Severity: LOW

**Purpose:** Default selector constants used as fallback.

**Key exports:** `SELECTORS`.

**Issues:**
1. **Duplicates the same values as `v145Selectors`**. Maintenance burden if selectors need updating. The duplication is intentional (default/fallback) but creates a sync risk.

**Tests:** `tests/unit/ui/selectors.test.ts` (28 lines).

---

### 2.3 Server and Configuration

#### `src/server.ts` (674 lines) - Severity: HIGH (most critical file)

**Purpose:** Core MCP server. Registers 12 tool handlers with `McpServer`, connects via stdio transport, handles all tool dispatch logic.

**Key exports:** `startServer()`, `toolDefinitions`, `ToolDef`.

**Issues:**
1. **Largest file in the project** (674 lines) with heterogeneous logic: tool definitions + handler dispatch + polling loop + response extraction. Should be split into separate modules.
2. **Line 52: Zod internal API access** - `(current as any)._def.innerType` to unwrap optional schemas. Acknowledged with biome-ignore.
3. **Line 225-234: `parseAgentStatus` does `as RawAgentStatus` cast** without validation. Malformed JSON from the browser could produce unexpected shapes.
4. **Lines 373-437: Polling loop in `comet_ask`** is the most logic-dense section of the codebase with 6 state variables (`sawNewResponse`, `stallCount`, `timedOut`, `collectedSteps`, `lastResponse`). Should be extracted into a dedicated polling state machine.
5. **Line 627: `comet_open_conversation` SSRF check** - `parsed.hostname.endsWith('perplexity.ai')` would also match `evilperplexity.ai`. However, this is mitigated since only subdomains of `perplexity.ai` are valid Comet URLs.

**Tests:** `tests/unit/tools/handlers.test.ts` (47 lines), `tests/unit/tools/registry.test.ts` (60 lines), `tests/integration/tools/core-tools.test.ts` (408 lines), `tests/integration/tools/extraction-tools.test.ts` (202 lines), `tests/integration/tools/ui-tools.test.ts` (213 lines).

---

#### `src/config.ts` (114 lines) - Severity: MEDIUM

**Purpose:** Loads configuration from defaults < config file < environment variables < programmatic overrides.

**Key exports:** `loadConfig(overrides?)`.

**Issues:**
1. **Line 39: `(result as any)[key]`** for dynamic key assignment. Could be typed more precisely.
2. **Lines 74, 78: unchecked type assertions** `as CometConfig['logLevel']` and `as CometConfig['screenshotFormat']` on env var values. Invalid values like `ASTERIA_LOG_LEVEL=verbose` pass through without validation.
3. **No runtime validation of config values** (e.g., port range 1-65535, timeout positivity, poll interval minimum).

**Tests:** `tests/unit/config.test.ts` (127 lines) - excellent coverage including defaults, env var overrides, programmatic overrides, config file loading, malformed JSON fallback, invalid number fallback.

---

#### `src/cli.ts` (278 lines) - Severity: MEDIUM

**Purpose:** CLI binary supporting `start`, `call`, `detect`, `--version`, `--help` commands.

**Issues:**
1. **Line 158: `process.execPath` used to spawn child** - `asteria call` works only when run via `node dist/cli.js`, not as a globally installed binary. Should use `process.argv[1]` or resolve the script path differently.
2. **Line 197-198: screenshots saved to CWD** with timestamped name. No user control over output location, no path sanitization.
3. **Timeout of 180s** (line 234) is hardcoded.

**Tests:** `tests/unit/cli.test.ts` (66 lines), `tests/unit/cli-run.test.ts` (324 lines).

---

#### `src/index.ts` (7 lines) - Severity: LOW

**Purpose:** Entry point. Imports and calls `startServer()`.

**Issues:**
1. **`.catch((_err) => { process.exit(1) })`** silently swallows the error without logging. Makes debugging startup failures harder.

**Tests:** None (trivial entry point).

---

#### `src/errors.ts` (99 lines) - Severity: NONE

**Purpose:** Custom error hierarchy with `AsteriaError` base + 8 subclasses + `toMcpError` converter.

**Issues:** None. Well-designed error hierarchy with structured codes and context. Exemplary model.

**Tests:** `tests/unit/errors.test.ts` (79 lines) - thorough coverage.

---

#### `src/logger.ts` (39 lines) - Severity: NONE

**Purpose:** Leveled logger that writes to stderr (avoids interfering with MCP stdio on stdout).

**Issues:** None.

**Tests:** `tests/unit/logger.test.ts` (55 lines).

---

#### `src/snapshot.ts` (40 lines) - Severity: LOW

**Purpose:** Debug utility that connects to Comet and dumps a DOM snapshot.

**Issues:**
1. **`const _logger = createLogger('info')`** (line 6) creates a logger that is never used.

**Tests:** `tests/unit/snapshot.test.ts` (28 lines).

---

#### `src/version.ts` (26 lines) - Severity: MEDIUM

**Purpose:** Detects Comet's Chrome version via `/json/version` and loads matching selector set.

**Issues:**
1. **On fetch failure** (line 21), silently falls back to v145 selectors without logging a warning. Could hide connectivity issues.

**Tests:** `tests/unit/version.test.ts` (44 lines).

---

#### `src/prose-filter.ts` (66 lines) - Severity: LOW

**Purpose:** Shared logic for finding and filtering "prose" content elements.

**Issues:**
1. Large JS code string embedded in TypeScript. Harder to debug and test.
2. 100-character minimum and question-mark filtering heuristics are hardcoded.

**Tests:** `tests/unit/prose-filter.test.ts` (86 lines).

---

### 2.4 Selectors

#### `src/selectors/index.ts` (15 lines) - Severity: MEDIUM

**Issues:** Only v145 registered. All other versions fallback to v145, which breaks if Comet updates its DOM.

#### `src/selectors/v145.ts` (22 lines) - Severity: LOW

**Issues:** Selectors tightly coupled to Comet's internal DOM. Any Comet UI update could break them.

#### `src/selectors/types.ts` (10 lines) - Severity: NONE

Clean type definition. No issues.

---

## 3. Cross-Cutting Analysis

### 3.1 Dependencies

| Dependency | Version | Status |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.12.1 | Current, appropriate |
| `chrome-remote-interface` | ^0.33.2 | Mature, well-maintained |
| `zod` | ^3.25.76 | Current |
| `@biomejs/biome` | ^2.4.10 | Current |
| `@types/chrome-remote-interface` | ^0.33.0 | Matched to library |
| `@types/node` | ^20.11.0 | Slightly behind (22.x types exist) but functional |
| `@vitest/coverage-v8` | ^1.6.1 | Stable |
| `typescript` | ^5.4.0 | Current |
| `vitest` | ^1.6.0 | Current |

**Assessment:** All dependencies are reasonable, up-to-date, and from well-known sources. No concerning or unnecessary dependencies.

---

### 3.2 Type Safety

**`any` type usages in `src/`:**
1. `src/config.ts:39` - `(result as any)[key]` - Dynamic key assignment, suppressed with biome-ignore.
2. `src/server.ts:52` - `(current as any)._def.innerType` - Zod internal API access, suppressed with biome-ignore.

Both are acknowledged with `biome-ignore` comments. No unchecked `any` types elsewhere.

**Unsafe casts:**
1. `src/server.ts:233` - `return raw as RawAgentStatus` - No validation after `JSON.parse`.
2. `src/cdp/client.ts:189` - `as Promise<EvaluateResult>` - Unvalidated CRI response.
3. `src/config.ts:74,78` - `as CometConfig['logLevel']` / `as CometConfig['screenshotFormat']` - Unvalidated env var assertions.

---

### 3.3 Error Handling

The codebase follows a consistent and well-structured error handling pattern:
1. Custom error hierarchy (8 domain-specific subclasses) with structured codes and context.
2. `toMcpError()` converts all errors into uniform MCP error responses.
3. Every tool handler wraps its body in `try/catch(err) { return toMcpError(err) }`.
4. Auto-reconnect with exponential backoff for transient CDP failures.
5. Best-effort operations (like `closeExtraTabs`) catch and log errors.

---

### 3.4 Test Coverage

| Source File | Unit Tests | Integration Tests |
|---|---|---|
| `src/index.ts` | No | No |
| `src/cli.ts` | Yes (2 files) | No |
| `src/config.ts` | Yes | Indirect (via harness) |
| `src/errors.ts` | Yes | No |
| `src/logger.ts` | Yes | No |
| `src/prose-filter.ts` | Yes | No |
| `src/server.ts` | Yes (2 files) | Yes (3 files) |
| `src/snapshot.ts` | Yes | No |
| `src/types.ts` | Yes | No |
| `src/version.ts` | Yes | Yes |
| `src/cdp/browser.ts` | Yes | No |
| `src/cdp/client.ts` | Yes | Indirect (via harness) |
| `src/cdp/connection.ts` | Yes | No |
| `src/cdp/tabs.ts` | Yes | No |
| `src/selectors/index.ts` | Yes | Yes |
| `src/selectors/types.ts` | No | No |
| `src/selectors/v145.ts` | Yes | No |
| `src/ui/*` (6 files) | All covered | Partial (via extraction-tools, ui-tools) |

**Coverage gaps:**
- `src/index.ts` and `src/selectors/types.ts` lack tests (both trivial files).
- `browser.test.ts` has tests calling real `httpbin.org` - potential CI flakiness.
- `handlers.test.ts` and `registry.test.ts` partially overlap.
- `version-detect.test.ts` (integration) duplicates `version.test.ts` (unit).

---

### 3.5 Security

| Area | Severity | Detail |
|---|---|---|
| SSRF Prevention | GOOD | `https:` + `perplexity.ai` hostname validation, tests for domain suffix attack |
| JS Injection | GOOD | `JSON.stringify()` for prompt embedding, tests for backtick/template literal injection |
| CDP Port Binding | LOW | Hardcoded `127.0.0.1`, but any local process can connect to port 9222 |
| Process Management | MEDIUM | `killComet()` kills all Comet processes, not just Asteria's |
| API Key Exposure | MITIGATED | `.mcp.json` has keys but is in `.gitignore` |
| Config Validation | MEDIUM | No runtime validation of env var values |
| Domain Suffix SSRF | MEDIUM | `evilperplexity.ai` passes `endsWith('perplexity.ai')` check |

---

### 3.6 Documentation

| Document | Status | Gaps |
|---|---|---|
| README.md | Complete (9,575 chars) | None |
| architecture.md | Present (36 lines) | Could be more detailed |
| configuration.md | Incomplete | Missing `ASTERIA_USER_DATA_DIR`, `ASTERIA_WINDOW_WIDTH/HEIGHT` |
| contributing.md | Present, concise | Adequate |
| comet-compatibility.md | Present | Only v145 documented |
| uat-checklist.md | Present | **No items executed yet** |
| JSDoc inline | Minimal | Most functions lack formal doc comments |

---

## 4. Priority Actions

### P0 - Critical (blocks production)

1. **Verify and fix mode switch** - `setTimeout` in `buildModeSwitchScript` may not execute within `Runtime.evaluate` context. Test manually and fix if broken.
2. **Execute UAT checklist** - No manual testing has been done yet. All items in `docs/uat-checklist.md` are unchecked.
3. **Fix domain suffix SSRF** - `endsWith('perplexity.ai')` matches `evilperplexity.ai`. Use proper suffix check (`=== 'perplexity.ai' || endsWith('.perplexity.ai')`).

### P1 - Important (degrades maintainability)

4. Extract polling loop from `server.ts` into a dedicated state machine (~60 lines of complex logic).
5. Add PID tracking for `killComet()` and cleanup handler for parent crash.
6. Add runtime validation for config values (port range, timeout positivity).
7. Update `docs/configuration.md` with missing env vars.
8. Replace `httpbin.org` calls in tests with a local mock server.
9. Fix `process.execPath` in CLI to work as global binary.

### P2 - Improvement (nice-to-have)

10. Add JSDoc to public functions.
11. Remove `SELECTORS` vs `v145Selectors` duplication.
12. Add support for future Comet versions in selector registry.
13. Log startup errors in `src/index.ts` catch block.
14. Remove unused `_logger` in `src/snapshot.ts`.
15. Log a warning when version detection falls back to default selectors.

---

## 5. Overall Assessment

**Asteria is a well-structured project with strong fundamentals.** The 3-layer architecture is clean, error handling is exemplary, test coverage is strong, and security hardening is serious. The main risks are:

1. **Fragility to Comet UI changes** - The entire UI automation layer (selectors, status detection, mode switching) is tightly coupled to Comet's DOM structure. A Comet update could break multiple tools simultaneously.
2. **No manual testing completed** - The UAT checklist exists but hasn't been executed.
3. **One potential production bug** - The mode switch `setTimeout` pattern may not work in CDP evaluation context.

For a v0.1.0 pre-release, the codebase quality is above average. The priority should be: execute UAT -> fix P0 bugs -> npm publish.
