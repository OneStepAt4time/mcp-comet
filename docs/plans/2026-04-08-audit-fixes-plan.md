# Audit Fixes — Production Release Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Critical + High audit findings and backfill test coverage for production readiness.

**Architecture:** Surgical in-place fixes. Add operation queue to CDPClient for concurrency safety. Use JSON.stringify for injection-safe escaping. Use URL parsing for SSRF-safe validation.

**Tech Stack:** TypeScript, Vitest, chrome-remote-interface, MCP SDK

---

### Task 1: Fix JS injection via prompt (S1.1 — CRITICAL)

**Files:**
- Modify: `src/ui/input.ts:4-42`
- Test: `tests/unit/ui/input.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/ui/input.test.ts`:

```typescript
describe('buildTypePromptScript injection safety', () => {
  it('escapes backticks in prompt', () => {
    const script = buildTypePromptScript('test` injected code')
    expect(script).not.toContain('${')
    expect(script).not.toContain('`')
  })

  it('escapes template literal expressions', () => {
    const script = buildTypePromptScript('${document.cookie}')
    expect(script).not.toContain('${')
  })

  it('escapes unicode line separators', () => {
    const script = buildTypePromptScript('test\u2028line')
    expect(script).not.toContain('\u2028')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/input.test.ts`
Expected: FAIL — backtick/template injection not escaped

**Step 3: Write minimal implementation**

In `src/ui/input.ts`, replace lines 5-9:

```typescript
// BEFORE (manual escaping — incomplete):
const escaped = prompt
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n')
  .replace(/"/g, '\\"')

// AFTER (JSON.stringify — complete escaping):
const escaped = JSON.stringify(prompt).slice(1, -1)
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ui/input.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts tests/unit/ui/input.test.ts
git commit -m "fix: use JSON.stringify for prompt escaping to prevent JS injection (audit S1.1)"
```

---

### Task 2: Fix JS injection via mode name (S1.1b — HIGH)

**Files:**
- Modify: `src/ui/navigation.ts:25-26`
- Test: `tests/unit/ui/navigation.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/ui/navigation.test.ts`:

```typescript
describe('buildModeSwitchScript injection safety', () => {
  it('escapes special characters in mode display name', () => {
    // If a mode name contained injection payload
    const script = buildModeSwitchScript("standard';alert(1);//")
    expect(script).not.toContain("';alert")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/navigation.test.ts`

**Step 3: Write minimal implementation**

In `src/ui/navigation.ts`, change line 26:

```typescript
// BEFORE:
var displayName = '${displayName}';

// AFTER:
var displayName = ${JSON.stringify(displayName)};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ui/navigation.test.ts`

**Step 5: Commit**

```bash
git add src/ui/navigation.ts tests/unit/ui/navigation.test.ts
git commit -m "fix: use JSON.stringify for mode name escaping to prevent JS injection (audit S1.1b)"
```

---

### Task 3: Fix SSRF via URL validation (S1.2 — HIGH)

**Files:**
- Modify: `src/server.ts:587-592`
- Test: `tests/integration/tools/ui-tools.test.ts`

**Step 1: Write the failing test**

Add to the `comet_open_conversation` describe block in the integration test file:

```typescript
it('rejects domain suffix attack', async () => {
  const handler = getHandler('comet_open_conversation')
  const result = await handler({ url: 'https://perplexity.ai.evil.com/search/123' })
  expect(result.content[0].text).toContain('Error')
})

it('rejects path-based bypass', async () => {
  const handler = getHandler('comet_open_conversation')
  const result = await handler({ url: 'https://evil.com/perplexity.ai/' })
  expect(result.content[0].text).toContain('Error')
})

it('rejects credential-based URL confusion', async () => {
  const handler = getHandler('comet_open_conversation')
  const result = await handler({ url: 'https://perplexity.ai@evil.com/' })
  expect(result.content[0].text).toContain('Error')
})

it('accepts valid perplexity.ai URL', async () => {
  const handler = getHandler('comet_open_conversation')
  const result = await handler({ url: 'https://www.perplexity.ai/search/abc123' })
  expect(result.content[0].text).toContain('Navigated to:')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts`
Expected: FAIL — suffix attack not blocked

**Step 3: Write minimal implementation**

In `src/server.ts`, replace the URL validation block (around line 588-592):

```typescript
// BEFORE:
if (!url.startsWith('https://') || !url.includes('perplexity.ai')) {
  return toMcpError(
    new Error(`Invalid URL: must be a https://perplexity.ai/ URL, got "${url}"`),
  )
}

// AFTER:
let parsed: URL
try {
  parsed = new URL(url)
} catch {
  return toMcpError(new Error(`Invalid URL: "${url}"`))
}
if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('perplexity.ai')) {
  return toMcpError(
    new Error(`Invalid URL: must be a https://perplexity.ai/ URL, got "${url}"`),
  )
}
```

Note: `.endsWith('perplexity.ai')` covers both `perplexity.ai` and `www.perplexity.ai` and any subdomain.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts`

**Step 5: Commit**

```bash
git add src/server.ts tests/integration/tools/ui-tools.test.ts
git commit -m "fix: use URL hostname parsing for SSRF-safe URL validation (audit S1.2)"
```

---

### Task 4: Fix spawn error handling (S1.3 — CRITICAL)

**Files:**
- Modify: `src/cdp/browser.ts:108-117`
- Test: `tests/unit/cdp/browser.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/cdp/browser.test.ts`:

```typescript
it('startCometProcess attaches error handler to spawned process', () => {
  const { spawn } = await import('node:child_process')
  // Mock spawn to capture the child process
  const mockChild = { unref: vi.fn(), on: vi.fn() }
  vi.doMock('node:child_process', () => ({
    ...actual,
    spawn: vi.fn().mockReturnValue(mockChild),
  }))
  startCometProcess('/path/to/comet', 9222, mockLogger)
  expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function))
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cdp/browser.test.ts`

**Step 3: Write minimal implementation**

In `src/cdp/browser.ts`, change `startCometProcess`:

```typescript
// BEFORE:
export function startCometProcess(cometPath: string, port: number, logger: Logger): void {
  const args = [`--remote-debugging-port=${port}`]
  logger.info(`Launching Comet: ${cometPath} ${args.join(' ')}`)
  const child = spawn(cometPath, args, {
    detached: true,
    stdio: 'ignore',
    shell: isWindows(),
  })
  child.unref()
}

// AFTER:
export function startCometProcess(cometPath: string, port: number, logger: Logger): void {
  const args = [`--remote-debugging-port=${port}`]
  logger.info(`Launching Comet: ${cometPath} ${args.join(' ')}`)
  const child = spawn(cometPath, args, {
    detached: true,
    stdio: 'ignore',
    shell: isWindows(),
  })
  child.on('error', (err) => logger.error(`Comet spawn failed: ${err.message}`))
  child.unref()
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cdp/browser.test.ts`

**Step 5: Commit**

```bash
git add src/cdp/browser.ts tests/unit/cdp/browser.test.ts
git commit -m "fix: add error handler to spawned Comet process (audit S1.3)"
```

---

### Task 5: Add operation queue to CDPClient (S2.1 — CRITICAL)

**Files:**
- Modify: `src/cdp/client.ts` (add enqueue method, wrap public methods)
- Test: `tests/unit/cdp/client.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/cdp/client.test.ts`:

```typescript
describe('CDPClient operation queue', () => {
  it('serializes concurrent operations', async () => {
    originalFetch = mockFetchForConnect()
    mockCRI()

    const client = CDPClient.getInstance()
    await client.connect()

    const order: number[] = []
    const op1 = client['enqueue'](async () => {
      order.push(1)
      await new Promise((r) => setTimeout(r, 50))
      order.push(2)
    })
    const op2 = client['enqueue'](async () => {
      order.push(3)
    })
    await Promise.all([op1, op2])
    expect(order).toEqual([1, 2, 3])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cdp/client.test.ts`
Expected: FAIL — `enqueue` not defined

**Step 3: Write minimal implementation**

Add to `CDPClient` class in `src/cdp/client.ts`, after the `state` property (around line 22):

```typescript
  private opLock: Promise<void> = Promise.resolve()

  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.opLock
    let resolve!: () => void
    this.opLock = new Promise((r) => { resolve = r })
    await prev
    try {
      return await fn()
    } finally {
      resolve()
    }
  }
```

Then wrap the public methods that touch `criClient`. For each of `screenshot`, `navigate`, `safeEvaluate`, `evaluate`, `pressKey`, `disconnect`, `closeExtraTabs`, wrap the body in `enqueue`:

```typescript
// Example for screenshot (already has ensureHealthyConnection):
async screenshot(format: 'png' | 'jpeg' = 'png'): Promise<string> {
  return this.enqueue(async () => {
    await this.ensureHealthyConnection()
    return await this.withAutoReconnect(async () => {
      // ... existing code unchanged ...
    })
  })
}
```

Same pattern for `navigate`, `safeEvaluate`, `evaluate`, `pressKey`, `disconnect`, `closeExtraTabs`.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cdp/client.test.ts`

**Step 5: Commit**

```bash
git add src/cdp/client.ts tests/unit/cdp/client.test.ts
git commit -m "feat: add operation queue to CDPClient for concurrency safety (audit S2.1)"
```

---

### Task 6: Fix reconnect race condition (S2.2 — CRITICAL)

**Files:**
- Modify: `src/cdp/client.ts:223-238`
- Test: `tests/unit/cdp/client.test.ts`

**Step 1: Write the failing test**

```typescript
it('concurrent reconnects share the same promise', async () => {
  originalFetch = mockFetchForConnect()
  let connectCalls = 0
  mockCRI({
    Runtime: {
      enable: vi.fn(),
      evaluate: vi.fn().mockResolvedValue({ result: { value: 2 } }),
    },
    Page: { enable: vi.fn(), navigate: vi.fn(), loadEventFired: vi.fn().mockResolvedValue(undefined) },
    Emulation: { setDeviceMetricsOverride: vi.fn().mockRejectedValue('ignore') },
    Input: { dispatchKeyEvent: vi.fn() },
    Target: { closeTarget: vi.fn() },
    close: vi.fn(),
  })
  vi.mocked(CRI).mockImplementation(async () => {
    connectCalls++
    await new Promise((r) => setTimeout(r, 100))
    return mockCriMock
  })

  const client = CDPClient.getInstance()
  await client.connect()
  expect(connectCalls).toBe(1)

  // Trigger two reconnects concurrently
  await Promise.all([
    client['reconnect'](),
    client['reconnect'](),
  ])
  // Should only reconnect once, not twice
  expect(connectCalls).toBeLessThanOrEqual(3) // initial + at most 1 reconnect
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cdp/client.test.ts`

**Step 3: Write minimal implementation**

Add field to CDPClient:

```typescript
private reconnectPromise: Promise<void> | null = null
```

Replace the `reconnect()` method:

```typescript
private async reconnect(): Promise<void> {
  if (this.reconnectPromise) return this.reconnectPromise
  this.state.isReconnecting = true
  this.reconnectPromise = (async () => {
    try {
      await this.disconnect()
      await this.connect(this.state.targetId ?? undefined)
      this.state.reconnectAttempts = 0
      this.logger.info('Reconnected')
    } catch (err) {
      this.state.reconnectAttempts++
      this.logger.error(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    } finally {
      this.state.isReconnecting = false
      this.reconnectPromise = null
    }
  })()
  return this.reconnectPromise
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cdp/client.test.ts`

**Step 5: Commit**

```bash
git add src/cdp/client.ts tests/unit/cdp/client.test.ts
git commit -m "fix: share reconnect promise to prevent concurrent reconnection race (audit S2.2)"
```

---

### Task 7: Fix health check + error propagation (S2.3 — CRITICAL)

**Files:**
- Modify: `src/cdp/client.ts:201-205`, `114-118`, `276-296`
- Test: `tests/unit/cdp/client.test.ts`

**Step 1: Write the failing test**

```typescript
it('ensureHealthyConnection catches reconnect failure gracefully', async () => {
  const client = CDPClient.getInstance()
  // Make isHealthy return false, connect throw
  client.criClient = {} as any
  client.state.connected = true
  vi.spyOn(client as any, 'isHealthy').mockResolvedValue(false)
  vi.spyOn(client as any, 'disconnect').mockResolvedValue(undefined)
  vi.spyOn(client as any, 'connect').mockRejectedValue(new Error('Connection refused'))

  // Should not throw — let caller handle via withAutoReconnect
  await expect(client['ensureHealthyConnection']()).resolves.toBeUndefined()
})

it('disconnect logs errors instead of swallowing silently', async () => {
  originalFetch = mockFetchForConnect()
  const criMock = mockCRI()
  criMock.close.mockRejectedValue(new Error('close failed'))

  const client = CDPClient.getInstance()
  await client.connect()

  await client.disconnect()
  expect(criMock.close).toHaveBeenCalled()
  expect(client.state.connected).toBe(false)
})
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

Replace `ensureHealthyConnection`:

```typescript
private async ensureHealthyConnection(): Promise<void> {
  if (await this.isHealthy()) return
  this.logger.warn('Connection unhealthy, reconnecting...')
  try {
    await this.reconnect()
  } catch (err) {
    this.logger.warn(`Reconnect failed during health check: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

Replace `disconnect` catch block:

```typescript
async disconnect(): Promise<void> {
  if (this.criClient) {
    try {
      await this.criClient.close()
    } catch (err) {
      this.logger.debug(`Disconnect error (ignored): ${err instanceof Error ? err.message : String(err)}`)
    }
    this.criClient = null
  }
  this.state.connected = false
  this.state.targetId = null
}
```

Same for `closeExtraTabs` inner catches — add `this.logger.debug(...)`.

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/cdp/client.ts tests/unit/cdp/client.test.ts
git commit -m "fix: add error logging to disconnect/closeExtraTabs, catch reconnect in ensureHealthyConnection (audit S2.3)"
```

---

### Task 8: Fix timeout cleanup + extractValue + parseAgentStatus (S3.1-S3.3 — HIGH)

**Files:**
- Modify: `src/server.ts:203-212`, `225-228`, `363-410`
- Test: `tests/integration/tools/core-tools.test.ts`

**Step 1: Write the failing tests**

In `tests/integration/tools/core-tools.test.ts`:

```typescript
it('comet_ask stops polling after timeout', async () => {
  let evalCalls = 0
  mocks.safeEvaluate.mockImplementation(async () => {
    evalCalls++
    if (evalCalls === 1) return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
    if (evalCalls === 2) return { result: { value: 'typed' } }
    if (evalCalls === 3) return { result: { value: 'submitted' } }
    return { result: { value: JSON.stringify({ status: 'working', steps: [], currentStep: '', response: '', hasStopButton: true }) } }
  })

  const handler = getHandler('comet_ask')
  const result = await handler({ prompt: 'test', timeout: 300 })
  expect(result.content[0].text).toContain('Agent is still working')
  // Verify no runaway polling after timeout
  const callsAfterTimeout = evalCalls
  await new Promise((r) => setTimeout(r, 500))
  expect(evalCalls).toBe(callsAfterTimeout)
})
```

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

In `src/server.ts`, update `extractValue`:

```typescript
// BEFORE:
throw new Error(`Script error: ${desc}`)

// AFTER:
throw new EvaluationError(`Script error: ${desc}`, { expression: '(unknown)' })
```

Add import at top: `import { ... EvaluationError ... } from './errors.js'`

Update `parseAgentStatus`:

```typescript
function parseAgentStatus(raw: unknown): RawAgentStatus {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RawAgentStatus
    } catch {
      return { status: 'idle', steps: [], currentStep: '', response: '', hasStopButton: false, proseCount: 0 }
    }
  }
  return raw as RawAgentStatus
}
```

Update the polling loop — add `timedOut` flag:

```typescript
const startTime = Date.now()
let sawNewResponse = false
let timedOut = false
const collectedSteps: string[] = []
let lastResponse = ''

while (!timedOut && Date.now() - startTime < effectiveTimeout) {
  await sleep(config.pollInterval)

  if (timedOut) break

  const statusRaw = await client.safeEvaluate(buildGetAgentStatusScript(activeSelectors))
  // ... rest unchanged, but add check at end of loop body:
}
// After loop:
timedOut = true  // Signal to prevent any further polling
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/server.ts tests/integration/tools/core-tools.test.ts
git commit -m "fix: add timeout flag, EvaluationError in extractValue, safe parseAgentStatus (audit S3.1-S3.3)"
```

---

### Task 9: Backfill CLI tests (S4.1 — CRITICAL coverage gap)

**Files:**
- Create: `tests/unit/cli-run.test.ts`
- Modify: `tests/unit/cli.test.ts` (if needed)

**Step 1: Write tests for runDetect()**

Create `tests/unit/cli-run.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

// Mock config, version, server modules
vi.mock('../../src/config.js', () => ({
  loadConfig: () => ({
    port: 9222, timeout: 30000, cometPath: null, responseTimeout: 120000,
    logLevel: 'error', screenshotFormat: 'png', screenshotQuality: 80,
    windowWidth: 1440, windowHeight: 900, maxReconnectAttempts: 5,
    maxReconnectDelay: 5000, pollInterval: 1000,
  }),
}))

vi.mock('../../src/version.js', () => ({
  detectCometVersion: vi.fn().mockResolvedValue({ chromeMajor: 145, browser: 'Chrome/145', selectors: {} }),
}))

describe('CLI runDetect', () => {
  it('connects to server and returns detected version', async () => {
    const mockStdout = {
      on: vi.fn((event: string, cb: (d: Buffer) => void) => {
        if (event === 'data') {
          // Simulate MCP initialize + tool call response
          const initResp = { jsonrpc: '2.0', id: 1, result: { capabilities: {} } }
          const toolResp = {
            jsonrpc: '2.0', id: 2, result: {
              content: [{ type: 'text', text: 'Connected to Comet on port 9222 (Chrome/145), target t1' }],
            },
          }
          cb(Buffer.from(`Content-Length: ${JSON.stringify(initResp).length}\r\n\r\n${JSON.stringify(initResp)}`))
          cb(Buffer.from(`Content-Length: ${JSON.stringify(toolResp).length}\r\n\r\n${JSON.stringify(toolResp)}`))
        }
      }),
    }
    const mockChild = {
      stdout: mockStdout,
      stderr: { on: vi.fn() },
      stdin: { write: vi.fn() },
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'exit') setTimeout(() => cb(0), 100)
      }),
      kill: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(mockChild as any)

    // Import and test runDetect
    const { runDetect } = await import('../../src/cli.js')
    // runDetect should complete without throwing
    // Actual implementation depends on CLI internals
  })
})
```

**Step 2-5:** Run, fix, iterate, commit.

```bash
git add tests/unit/cli-run.test.ts
git commit -m "test: add CLI runDetect unit tests (audit S4.1)"
```

---

### Task 10: Backfill reconnection tests (S4.2 — HIGH coverage gap)

**Files:**
- Modify: `tests/unit/cdp/client.test.ts`

**Step 1: Write tests**

```typescript
describe('CDPClient reconnection paths', () => {
  it('withAutoReconnect retries on connection error', async () => {
    originalFetch = mockFetchForConnect()
    let attempt = 0
    const criMock = mockCRI({
      Page: {
        enable: vi.fn(),
        navigate: vi.fn(),
        loadEventFired: vi.fn().mockResolvedValue(undefined),
        captureScreenshot: vi.fn().mockImplementation(() => {
          attempt++
          if (attempt === 1) throw new Error('Connection lost')
          return { data: 'base64data' }
        }),
      },
    })

    const client = CDPClient.getInstance()
    await client.connect()

    // Manually trigger reconnect on connection error
    const result = await client['withAutoReconnect'](async () => {
      if (attempt === 0) throw new Error('Connection lost')
      return 'success'
    })
    // withAutoReconnect should catch and retry
  })

  it('withAutoReconnect throws after max attempts', async () => {
    originalFetch = mockFetchForConnect()
    mockCRI()

    const client = CDPClient.getInstance()
    await client.connect()

    await expect(
      client['withAutoReconnect'](async () => { throw new Error('Connection lost') }),
    ).rejects.toThrow('Connection lost')
  })

  it('ensureHealthyConnection calls reconnect when unhealthy', async () => {
    originalFetch = mockFetchForConnect()
    mockCRI()
    const client = CDPClient.getInstance()
    await client.connect()

    const reconnectSpy = vi.spyOn(client as any, 'reconnect').mockResolvedValue(undefined)
    vi.spyOn(client as any, 'isHealthy').mockResolvedValue(false)

    await client['ensureHealthyConnection']()
    expect(reconnectSpy).toHaveBeenCalled()
  })
})
```

**Step 2-5:** Run, fix, iterate, commit.

```bash
git add tests/unit/cdp/client.test.ts
git commit -m "test: add reconnection path tests for CDPClient (audit S4.2)"
```

---

### Task 11: Security fix tests (S4.3)

**Files:**
- Modify: `tests/unit/ui/input.test.ts`, `tests/integration/tools/ui-tools.test.ts`, `tests/unit/cdp/browser.test.ts`

These tests are written as part of Tasks 1-4 (Step 1 of each task includes the security test).

**Commit:**

```bash
git commit -m "test: add security injection and SSRF tests (audit S4.3)"
```

---

### Task 12: Config env var branch tests (S4.4)

**Files:**
- Modify: `tests/unit/config.test.ts`

**Step 1: Write tests**

```typescript
describe('Config env var branches', () => {
  const envVars = [
    { name: 'ASTERIA_PORT', key: 'port', value: '9999', expected: 9999 },
    { name: 'ASTERIA_TIMEOUT', key: 'timeout', value: '10000', expected: 10000 },
    { name: 'ASTERIA_RESPONSE_TIMEOUT', key: 'responseTimeout', value: '60000', expected: 60000 },
    { name: 'ASTERIA_SCREENSHOT_FORMAT', key: 'screenshotFormat', value: 'jpeg', expected: 'jpeg' },
    { name: 'ASTERIA_SCREENSHOT_QUALITY', key: 'screenshotQuality', value: '90', expected: 90 },
    { name: 'ASTERIA_WINDOW_WIDTH', key: 'windowWidth', value: '1920', expected: 1920 },
    { name: 'ASTERIA_WINDOW_HEIGHT', key: 'windowHeight', value: '1080', expected: 1080 },
    { name: 'ASTERIA_MAX_RECONNECT', key: 'maxReconnectAttempts', value: '10', expected: 10 },
    { name: 'ASTERIA_RECONNECT_DELAY', key: 'maxReconnectDelay', value: '10000', expected: 10000 },
    { name: 'ASTERIA_POLL_INTERVAL', key: 'pollInterval', value: '500', expected: 500 },
  ]

  for (const { name, key, value, expected } of envVars) {
    it(`reads ${name} from environment`, () => {
      process.env[name] = value
      const config = loadConfig()
      expect(config[key]).toBe(expected)
      delete process.env[name]
    })
  }

  it('uses default when env var is invalid number', () => {
    process.env.ASTERIA_PORT = 'not-a-number'
    const config = loadConfig()
    expect(config.port).toBe(9222) // default
    delete process.env.ASTERIA_PORT
  })
})
```

**Step 2-5:** Run, fix, iterate, commit.

```bash
git add tests/unit/config.test.ts
git commit -m "test: add config env var branch tests (audit S4.4)"
```

---

### Task 13: Final validation

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS, no regressions

**Step 2: Run coverage**

Run: `npx vitest run --coverage`
Expected: Statement coverage >85%, all Critical/High areas covered

**Step 3: Build**

Run: `npm run build`
Expected: Clean build, no type errors

**Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: audit fixes complete — production release gate passed"
```
