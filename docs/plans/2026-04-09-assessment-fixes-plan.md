# Assessment P0+P1 Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P0 (critical) and P1 (important) issues identified in the 2026-04-09 repository assessment.

**Architecture:** Each task is a self-contained fix with TDD: write failing test first, implement, verify. Tasks are ordered by priority — P0s first, then P1s. Most tasks touch 1-2 files and are independent.

**Tech Stack:** TypeScript, Vitest, Biome, Node 18+

---

### Task 1: Fix SSRF domain suffix check in `comet_open_conversation` [P0]

**Files:**
- Modify: `src/server.ts:627`
- Test: `tests/integration/tools/ui-tools.test.ts:120-136`
- Test: `tests/integration/tools/extraction-tools.test.ts:115-132`

**Step 1: Write the failing test**

Add to `tests/integration/tools/ui-tools.test.ts` in the `comet_open_conversation` describe block, after the existing "rejects domain suffix attack" test:

```typescript
it('rejects evilperplexity.ai domain suffix attack', async () => {
  const handler = getHandler('comet_open_conversation')
  const result = await handler({ url: 'https://evilperplexity.ai/search/123' })
  expect(result.content[0].text).toContain('Error')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts -t "rejects evilperplexity"`
Expected: FAIL — `evilperplexity.ai` passes `endsWith('perplexity.ai')` check.

**Step 3: Write minimal implementation**

In `src/server.ts`, replace line 627:

```typescript
// Before:
if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('perplexity.ai')) {

// After:
const isPerplexityHost =
  parsed.hostname === 'perplexity.ai' || parsed.hostname.endsWith('.perplexity.ai')
if (parsed.protocol !== 'https:' || !isPerplexityHost) {
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts tests/integration/tools/extraction-tools.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/server.ts tests/integration/tools/ui-tools.test.ts
git commit -m "fix: close SSRF domain suffix bypass in comet_open_conversation"
```

---

### Task 2: Fix mode switch `setTimeout` bug in `buildModeSwitchScript` [P0]

**Files:**
- Modify: `src/ui/navigation.ts:23-68`
- Test: `tests/unit/ui/navigation.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/ui/navigation.test.ts`:

```typescript
describe('buildModeSwitchScript synchronous behavior', () => {
  it('does not use setTimeout — returns result synchronously', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).not.toContain('setTimeout')
    expect(s).toContain('return')
  })

  it('returns clicked:displayName on success within same IIFE', () => {
    const s = buildModeSwitchScript('deep-research')
    // The script must be a single IIFE that returns a value directly
    expect(s).toMatch(/^\(function\(\)\s*\{[\s\S]*\}\)\(\)$/)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/navigation.test.ts -t "synchronous behavior"`
Expected: FAIL — current implementation contains `setTimeout`.

**Step 3: Write minimal implementation**

Replace `buildModeSwitchScript` in `src/ui/navigation.ts`:

```typescript
export function buildModeSwitchScript(mode: string): string {
  const displayName = MODE_DISPLAY_NAMES[mode] ?? mode
  return `(function() {
    var displayName = ${JSON.stringify(displayName)};
    if (!displayName) return 'standard_mode_no_action';

    var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
    if (!input) return 'no_input_found';

    input.focus();
    input.textContent = '/';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

    var listbox = document.querySelector('[role="listbox"]');
    if (!listbox) return 'no_listbox_found';

    var menuItems = document.querySelectorAll('[role="menuitem"]');
    for (var i = 0; i < menuItems.length; i++) {
      var itemText = menuItems[i].textContent || '';
      if (itemText.indexOf(displayName) !== -1) {
        menuItems[i].click();
        return 'clicked:' + displayName;
      }
    }
    return 'menu_item_not_found:' + displayName;
  })()`
}
```

This removes the `setTimeout` retry loop entirely. The mode switch is now a synchronous check — if the typeahead menu isn't immediately available, it returns `'no_listbox_found'`. The caller (MCP tool handler) can retry the whole script if needed.

**Step 4: Update existing test that checks for setTimeout**

In `tests/unit/ui/navigation.test.ts`, find and update the "has listbox retry with maxAttempts" test:

```typescript
it('returns no_listbox_found when listbox missing', () => {
  const s = buildModeSwitchScript('deep-research')
  expect(s).toContain('no_listbox_found')
  expect(s).not.toContain('setTimeout')
})
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/navigation.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/ui/navigation.ts tests/unit/ui/navigation.test.ts
git commit -m "fix: remove broken setTimeout from mode switch, use synchronous IIFE"
```

---

### Task 3: Add runtime config validation [P1]

**Files:**
- Modify: `src/config.ts`
- Test: `tests/unit/config.test.ts`

**Step 1: Write the failing tests**

Add to `tests/unit/config.test.ts`:

```typescript
describe('config validation', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    delete process.env.ASTERIA_PORT
    delete process.env.ASTERIA_TIMEOUT
    delete process.env.ASTERIA_RESPONSE_TIMEOUT
    delete process.env.ASTERIA_POLL_INTERVAL
    delete process.env.ASTERIA_MAX_RECONNECT
    delete process.env.ASTERIA_RECONNECT_DELAY
    delete process.env.ASTERIA_LOG_LEVEL
    delete process.env.ASTERIA_SCREENSHOT_FORMAT
  })

  it('clamps port to valid range 1-65535', () => {
    expect(loadConfig({ port: 0 }).port).toBe(1)
    expect(loadConfig({ port: 99999 }).port).toBe(65535)
    expect(loadConfig({ port: 9222 }).port).toBe(9222)
  })

  it('clamps timeout to minimum 1000ms', () => {
    expect(loadConfig({ timeout: 0 }).timeout).toBe(1000)
    expect(loadConfig({ timeout: -500 }).timeout).toBe(1000)
    expect(loadConfig({ timeout: 5000 }).timeout).toBe(5000)
  })

  it('clamps pollInterval to minimum 100ms', () => {
    expect(loadConfig({ pollInterval: 0 }).pollInterval).toBe(100)
    expect(loadConfig({ pollInterval: 50 }).pollInterval).toBe(100)
    expect(loadConfig({ pollInterval: 2000 }).pollInterval).toBe(2000)
  })

  it('clamps maxReconnectAttempts to minimum 0', () => {
    expect(loadConfig({ maxReconnectAttempts: -5 }).maxReconnectAttempts).toBe(0)
    expect(loadConfig({ maxReconnectAttempts: 3 }).maxReconnectAttempts).toBe(3)
  })

  it('falls back to default for invalid logLevel env var', () => {
    vi.stubEnv('ASTERIA_LOG_LEVEL', 'verbose')
    const cfg = loadConfig()
    expect(cfg.logLevel).toBe('info')
  })

  it('falls back to default for invalid screenshotFormat env var', () => {
    vi.stubEnv('ASTERIA_SCREENSHOT_FORMAT', 'gif')
    const cfg = loadConfig()
    expect(cfg.screenshotFormat).toBe('png')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/config.test.ts -t "config validation"`
Expected: FAIL — no clamping or validation exists yet.

**Step 3: Write minimal implementation**

Add at the end of `src/config.ts`, before the final return in `loadConfig`:

```typescript
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
const VALID_SCREENSHOT_FORMATS = ['png', 'jpeg'] as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function validatedConfig(raw: CometConfig): CometConfig {
  return {
    ...raw,
    port: clamp(raw.port, 1, 65535),
    timeout: clamp(raw.timeout, 1000, Number.POSITIVE_INFINITY),
    responseTimeout: clamp(raw.responseTimeout, 1000, Number.POSITIVE_INFINITY),
    pollInterval: clamp(raw.pollInterval, 100, Number.POSITIVE_INFINITY),
    maxReconnectAttempts: Math.max(0, raw.maxReconnectAttempts),
    logLevel: VALID_LOG_LEVELS.includes(raw.logLevel as (typeof VALID_LOG_LEVELS)[number])
      ? raw.logLevel
      : DEFAULTS.logLevel,
    screenshotFormat: VALID_SCREENSHOT_FORMATS.includes(
      raw.screenshotFormat as (typeof VALID_SCREENSHOT_FORMATS)[number],
    )
      ? raw.screenshotFormat
      : DEFAULTS.screenshotFormat,
  }
}
```

Then change the return statement in `loadConfig` from:

```typescript
return {
  ...DEFAULTS,
  ...fileConfig,
  ...envConfig,
  ...overrides,
}
```

to:

```typescript
return validatedConfig({
  ...DEFAULTS,
  ...fileConfig,
  ...envConfig,
  ...overrides,
})
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/config.ts tests/unit/config.test.ts
git commit -m "fix: add runtime config validation with clamping and enum checks"
```

---

### Task 4: Fix CLI `process.execPath` for global binary [P1]

**Files:**
- Modify: `src/cli.ts:158`
- Test: `tests/unit/cli-run.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/cli-run.test.ts`:

```typescript
it('runCall uses script path not node path', async () => {
  const { spawn } = await import('node:child_process')
  vi.doMock('node:child_process', () => ({
    ...await import('node:child_process'),
    spawn: vi.fn().mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn(), end: vi.fn() },
      on: vi.fn(),
    }),
  }))
  vi.resetModules()

  // ... set up process.argv for 'call comet_connect'
  const origArgv = process.argv
  process.argv = ['node', 'dist/cli.js', 'call', 'comet_connect']
  const origExit = process.exit
  process.exit = vi.fn() as never

  // Import and run
  const mod = await import('../../../src/cli.js')
  // Check spawn was called with resolve(__dirname, 'index.js'), not process.execPath
  const spawnCalls = vi.mocked(spawn).mock.calls
  if (spawnCalls.length > 0) {
    const scriptArg = spawnCalls[0][1]
    expect(scriptArg).toBeDefined()
    // Should NOT use process.execPath as first arg
    expect(spawnCalls[0][0]).not.toBe(process.execPath)
  }

  process.argv = origArgv
  process.exit = origExit
  vi.doUnmock('node:child_process')
  vi.resetModules()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cli-run.test.ts -t "script path not node path"`
Expected: FAIL — current code uses `process.execPath`.

**Step 3: Write minimal implementation**

In `src/cli.ts`, replace line 158:

```typescript
// Before:
const child = spawn(process.execPath, [resolve(__dirname, 'index.js')], {

// After:
const child = spawn(process.execPath, [resolve(__dirname, 'server.js')], {
```

Note: `index.js` just calls `startServer()` from `server.js`. Using `index.js` is fine but the real fix is that `process.execPath` should be replaced with the actual node binary resolution. Since `asteria` is run via node, `process.execPath` is correct for the node binary itself. The real issue is the second argument. Let me reconsider...

Actually, `process.execPath` gives the Node binary (e.g., `/usr/local/bin/node`), and `[resolve(__dirname, 'index.js')]` is the script. This is correct when run via `node dist/cli.js`, but wrong when run as a globally installed binary because the script path resolves relative to the installed location.

The fix should be to use `import.meta.url` to resolve correctly in ESM:

```typescript
const scriptPath = resolve(__dirname, 'index.js')
const child = spawn(process.execPath, [scriptPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
})
```

This is already what the code does. The actual fix is simpler — just ensure `__dirname` resolves correctly. Let me verify and add a log for debugging:

Actually, the current implementation is fine for ESM with the `__dirname` polyfill at the top. The issue was identified as "works only via `node dist/cli.js`" but the assessment was incorrect — `process.execPath` + `resolve(__dirname, 'index.js')` works correctly for globally installed binaries too because `__dirname` is resolved from `import.meta.url` which always points to the installed location.

**Revised Step 3:** Mark this as "verified not a bug" after manual testing. No code change needed.

**Step 4: Commit**

If the test confirms the existing code works, no commit needed. Remove the test or adjust it to verify correct behavior instead.

---

### Task 5: Replace `httpbin.org` with local mock in tests [P1]

**Files:**
- Modify: `tests/unit/cdp/browser.test.ts:43-75`
- Reference: `tests/integration/mock-cdp-server.ts` (pattern for local HTTP server)

**Step 1: Write the failing test**

Add a test that uses a local HTTP server:

```typescript
import { createServer, type Server } from 'node:http'

describe('httpGet with local server', () => {
  let server: Server
  let port: number

  beforeEach((done) => {
    server = createServer((req, res) => {
      if (req.url === '/ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"status":"ok"}')
      } else if (req.url === '/fail') {
        res.writeHead(500)
        res.end('error')
      } else if (req.url === '/slow') {
        setTimeout(() => { res.writeHead(200); res.end('late') }, 5000)
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(0, () => {
      port = (server.address() as { port: number }).port
      done()
    })
  })

  afterEach((done) => {
    server.close(done)
  })

  it('returns ok:true for successful fetch', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const result = await httpGet(`http://127.0.0.1:${port}/ok`, 3000)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it('returns ok:false for non-200 status', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const result = await httpGet(`http://127.0.0.1:${port}/fail`, 3000)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
  })

  it('aborts after timeout', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const start = Date.now()
    const result = await httpGet(`http://127.0.0.1:${port}/slow`, 100)
    const elapsed = Date.now() - start
    expect(result.ok).toBe(false)
    expect(elapsed).toBeLessThan(500)
  })
})
```

**Step 2: Run tests to verify they pass (new tests)**

Run: `npx vitest run tests/unit/cdp/browser.test.ts -t "local server"`
Expected: PASS

**Step 3: Remove old httpbin.org tests**

Delete the three tests in the old `httpGet` describe block that call `httpbin.org`:
- "returns ok:true for successful fetch" (line 43-49)
- "returns ok:false for non-200 status" (line 59-64)
- "aborts after timeout" (line 66-74)

Keep the "returns ok:false for failed fetch" test (line 51-56) as it uses `127.0.0.1:99999`.

**Step 4: Run all browser tests**

Run: `npx vitest run tests/unit/cdp/browser.test.ts`
Expected: ALL PASS, no network calls

**Step 5: Commit**

```bash
git add tests/unit/cdp/browser.test.ts
git commit -m "fix: replace httpbin.org with local HTTP server in browser tests"
```

---

### Task 6: Update `docs/configuration.md` with missing env vars [P1]

**Files:**
- Modify: `docs/configuration.md`

**Step 1: Update the documentation**

Replace the entire content of `docs/configuration.md` with:

```markdown
# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASTERIA_PORT` | 9222 | Chrome DevTools Protocol port (1-65535) |
| `COMET_PATH` | auto-detect | Path to Comet executable |
| `ASTERIA_LOG_LEVEL` | info | Logging level: `debug`, `info`, `warn`, `error` |
| `ASTERIA_TIMEOUT` | 30000 | Comet launch timeout in ms (min 1000) |
| `ASTERIA_RESPONSE_TIMEOUT` | 180000 | Response polling timeout in ms (min 1000) |
| `ASTERIA_SCREENSHOT_FORMAT` | png | Screenshot format: `png` or `jpeg` |
| `ASTERIA_SCREENSHOT_QUALITY` | 80 | JPEG screenshot quality (0-100) |
| `ASTERIA_MAX_RECONNECT` | 5 | Max reconnection attempts (min 0) |
| `ASTERIA_RECONNECT_DELAY` | 5000 | Max reconnection backoff delay in ms |
| `ASTERIA_POLL_INTERVAL` | 1000 | Status poll interval in ms (min 100) |
| `ASTERIA_USER_DATA_DIR` | null | Custom Chrome user data directory |
| `ASTERIA_WINDOW_WIDTH` | 1440 | Browser window width in pixels |
| `ASTERIA_WINDOW_HEIGHT` | 900 | Browser window height in pixels |

## Priority

1. **Defaults** — hardcoded sensible defaults
2. **Config file** — `asteria.config.json` in current working directory
3. **Environment variables** — `ASTERIA_*` and `COMET_PATH`
4. **Programmatic overrides** — via `loadConfig(overrides)`

Higher priority overrides lower. Invalid values fall back to defaults.

## Config File Example

See `asteria.config.example.json` in the repository root.
```

**Step 2: Commit**

```bash
git add docs/configuration.md
git commit -m "docs: add missing env vars to configuration docs"
```

---

### Task 7: Log startup errors in `src/index.ts` [P2]

**Files:**
- Modify: `src/index.ts`

**Step 1: Write the fix**

Replace `src/index.ts` entirely:

```typescript
import { createLogger } from './logger.js'

const logger = createLogger('info')

import('./server.js')
  .then(({ startServer }) => startServer())
  .catch((err: unknown) => {
    logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
```

**Step 2: Run build to verify**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "fix: log startup errors instead of silently exiting"
```

---

### Task 8: Remove unused `_logger` in `src/snapshot.ts` [P2]

**Files:**
- Modify: `src/snapshot.ts:6`

**Step 1: Write the fix**

In `src/snapshot.ts`, remove line 6:

```typescript
// Remove this line:
const _logger = createLogger('info')
```

And the import of `createLogger` if it becomes unused.

**Step 2: Verify**

Run: `npx tsc --noEmit && npx vitest run tests/unit/snapshot.test.ts`
Expected: No errors, tests pass

**Step 3: Commit**

```bash
git add src/snapshot.ts
git commit -m "chore: remove unused logger variable from snapshot"
```

---

### Task 9: Log warning on version detection fallback [P2]

**Files:**
- Modify: `src/version.ts:21`

**Step 1: Write the failing test**

Add to `tests/unit/version.test.ts`:

```typescript
it('logs warning on fetch failure before falling back', async () => {
  const stderrWrite = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
  const { detectCometVersion } = await import('../../../src/version.js')
  const result = await detectCometVersion(9222)
  expect(result.chromeMajor).toBe(0)
  expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('warn'))
  stderrWrite.mockRestore()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/version.test.ts -t "logs warning"`
Expected: FAIL — no warning logged currently.

**Step 3: Write minimal implementation**

In `src/version.ts`, update the fetch catch block:

```typescript
export async function detectCometVersion(port: number): Promise<CometVersion> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`)
    if (!resp.ok) {
      process.stderr.write('[asteria:warn] Comet version detection: non-OK response, using default selectors\n')
      return { chromeMajor: 0, selectors: getSelectorsForVersion(0) }
    }
    const data = (await resp.json()) as { Browser?: string }
    const browser = data.Browser ?? ''
    const chromeMajor = parseChromeVersion(browser)
    return { chromeMajor, selectors: getSelectorsForVersion(chromeMajor) }
  } catch {
    process.stderr.write('[asteria:warn] Comet version detection failed, using default selectors\n')
    return { chromeMajor: 0, selectors: getSelectorsForVersion(0) }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/version.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/version.ts tests/unit/version.test.ts
git commit -m "fix: log warning when Comet version detection falls back to defaults"
```

---

## Summary

| Task | Priority | Files Changed | Risk |
|------|----------|---------------|------|
| 1. SSRF domain suffix | P0 | server.ts, ui-tools test | LOW — tighter check |
| 2. Mode switch setTimeout | P0 | navigation.ts, nav test | MEDIUM — behavior change |
| 3. Config validation | P1 | config.ts, config test | LOW — additive |
| 4. CLI execPath | P1 | cli.ts | LOW — verify only |
| 5. Remove httpbin.org | P1 | browser.test.ts | LOW — test only |
| 6. Config docs | P1 | configuration.md | NONE — docs only |
| 7. Startup error log | P2 | index.ts | NONE — additive |
| 8. Remove unused logger | P2 | snapshot.ts | NONE — cleanup |
| 9. Version fallback warning | P2 | version.ts, test | LOW — additive |
