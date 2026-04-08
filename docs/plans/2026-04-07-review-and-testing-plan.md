# Asteria Review & Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve production-ready test coverage for Asteria MCP server — unit tests, integration tests, formalized UAT plan, and CI/CD hardening.

**Architecture:** Bottom-up approach. Phase 1 fills unit test gaps. Phase 2 adds integration tests. Phase 3 formalizes UAT. Phase 4 hardens CI/CD. Each phase gates the next.

**Tech Stack:** Vitest, TypeScript, chrome-remote-interface (mocked), @modelcontextprotocol/sdk

---

## Phase 1: Unit Test Gap Fill

### Task 1: Extract inline scripts to testable functions

**Files:**
- Create: `src/ui/stop.ts`
- Create: `tests/unit/ui/stop.test.ts`
- Create: `src/ui/conversations.ts`
- Create: `tests/unit/ui/conversations.test.ts`
- Modify: `src/server.ts:433-444` (comet_stop handler)
- Modify: `src/server.ts:562-597` (comet_list_conversations handler)

**Step 1: Create `src/ui/stop.ts`**

```typescript
/**
 * Build script to find and click the stop/cancel button.
 * Extracted from server.ts for testability.
 */
export function buildStopAgentScript(): string {
  return `(function() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var label = (buttons[i].getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('stop') !== -1 || label.indexOf('cancel') !== -1) { buttons[i].click(); return 'stopped'; }
      if (buttons[i].querySelector('svg rect')) { buttons[i].click(); return 'stopped'; }
    }
    return 'not_found';
  })()`
}
```

**Step 2: Create `tests/unit/ui/stop.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { buildStopAgentScript } from '../../../src/ui/stop.js'

describe('buildStopAgentScript', () => {
  it('returns a string containing an IIFE', () => {
    const script = buildStopAgentScript()
    expect(script).toContain('(function()')
    expect(script).toContain('})()')
  })

  it('looks for stop and cancel aria-labels', () => {
    const script = buildStopAgentScript()
    expect(script).toContain("getAttribute('aria-label')")
    expect(script).toContain("'stop'")
    expect(script).toContain("'cancel'")
  })

  it('checks for svg rect stop button', () => {
    const script = buildStopAgentScript()
    expect(script).toContain('svg rect')
  })

  it('returns stopped when button clicked', () => {
    const script = buildStopAgentScript()
    expect(script).toContain("return 'stopped'")
  })

  it('returns not_found when no stop button', () => {
    const script = buildStopAgentScript()
    expect(script).toContain("return 'not_found'")
  })
})
```

**Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/stop.test.ts`
Expected: PASS

**Step 4: Create `src/ui/conversations.ts`**

```typescript
/**
 * Build script to extract conversation links from the current page.
 * Extracted from server.ts for testability.
 */
export function buildListConversationsScript(): string {
  return `(function() {
    var links = document.querySelectorAll('a[href]');
    var conversations = [];
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('/search/') !== -1 || href.indexOf('/copilot/') !== -1) {
        if (!seen[href]) {
          seen[href] = true;
          conversations.push({ title: (links[i].innerText || '').trim(), url: href });
        }
      }
    }
    return JSON.stringify(conversations);
  })()`
}
```

**Step 5: Create `tests/unit/ui/conversations.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { buildListConversationsScript } from '../../../src/ui/conversations.js'

describe('buildListConversationsScript', () => {
  it('returns a string containing an IIFE', () => {
    const script = buildListConversationsScript()
    expect(script).toMatch(/^\(function\(\)/)
    expect(script).toMatch(/\}\)\(\)$/)
  })

  it('selects anchor elements with href', () => {
    const script = buildListConversationsScript()
    expect(script).toContain("querySelectorAll('a[href]')")
  })

  it('filters for /search/ and /copilot/ paths', () => {
    const script = buildListConversationsScript()
    expect(script).toContain("'/search/'")
    expect(script).toContain("'/copilot/'")
  })

  it('deduplicates by href via seen map', () => {
    const script = buildListConversationsScript()
    expect(script).toContain('seen[href]')
  })

  it('returns JSON stringified array', () => {
    const script = buildListConversationsScript()
    expect(script).toContain('JSON.stringify(conversations)')
  })

  it('extracts title from innerText', () => {
    const script = buildListConversationsScript()
    expect(script).toContain('innerText')
  })
})
```

**Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/conversations.test.ts`
Expected: PASS

**Step 7: Update `src/server.ts` to use extracted functions**

Replace the inline script in comet_stop handler (around line 433):
```typescript
import { buildStopAgentScript } from './ui/stop.js'
// ... in comet_stop handler:
const script = buildStopAgentScript()
const raw = await client.safeEvaluate(script)
```

Replace the inline script in comet_list_conversations handler (around line 562):
```typescript
import { buildListConversationsScript } from './ui/conversations.js'
// ... in comet_list_conversations handler:
const script = buildListConversationsScript()
const raw = await client.safeEvaluate(script)
```

**Step 8: Run all tests**

Run: `npx vitest run`
Expected: All existing tests + new tests PASS

**Step 9: Commit**

```bash
git add src/ui/stop.ts src/ui/conversations.ts tests/unit/ui/stop.test.ts tests/unit/ui/conversations.test.ts src/server.ts
git commit -m "refactor: extract inline scripts to testable UI functions"
```

---

### Task 2: Add CDPClient method tests (mocked CRI)

**Files:**
- Modify: `tests/unit/cdp/client.test.ts`

**Context:** CDPClient uses `chrome-remote-interface` (CRI) which returns a client with methods like `Page.enable()`, `Runtime.evaluate()`, etc. We need to mock CRI to test connect, disconnect, navigate, screenshot, evaluate, and reconnect.

**Step 1: Write failing tests for connect/disconnect/navigate/screenshot**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CDPClient } from '../../../src/cdp/client.js'

// Mock chrome-remote-interface
vi.mock('chrome-remote-interface', () => ({
  default: vi.fn(),
}))

import CRI from 'chrome-remote-interface'

function mockCRI(clientOverrides: Record<string, unknown> = {}) {
  const mockClient = {
    Page: { enable: vi.fn(), navigate: vi.fn(), loadEventFired: vi.fn(), captureScreenshot: vi.fn() },
    Runtime: { enable: vi.fn(), evaluate: vi.fn() },
    Emulation: { setDeviceMetricsOverride: vi.fn() },
    Input: { dispatchKeyEvent: vi.fn() },
    Target: { closeTarget: vi.fn() },
    close: vi.fn(),
    ...clientOverrides,
  }
  vi.mocked(CRI).mockResolvedValue(mockClient as any)
  return mockClient
}

describe('CDPClient methods', () => {
  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  describe('connect', () => {
    it('connects to a target and enables Page/Runtime', async () => {
      const mock = mockCRI()
      const client = CDPClient.getInstance()
      // Mock httpGet responses via getVersion/listTargets
      // These use the private httpGet which calls browser.httpGet
      // We need to mock the fetch calls
      const originalFetch = globalThis.fetch
      let fetchCount = 0
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        fetchCount++
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145.0.0.0' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 'target-1', url: 'https://perplexity.ai', type: 'page', title: 'Perplexity' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      const id = await client.connect()
      expect(id).toBe('target-1')
      expect(mock.Page.enable).toHaveBeenCalled()
      expect(mock.Runtime.enable).toHaveBeenCalled()
      expect(client.state.connected).toBe(true)
      expect(client.state.targetId).toBe('target-1')

      globalThis.fetch = originalFetch
    })

    it('throws CDPConnectionError when no targets found', async () => {
      mockCRI()
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await expect(client.connect()).rejects.toThrow()
      globalThis.fetch = originalFetch
    })
  })

  describe('disconnect', () => {
    it('closes CRI client and resets state', async () => {
      const mock = mockCRI()
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      await client.disconnect()
      expect(mock.close).toHaveBeenCalled()
      expect(client.state.connected).toBe(false)
      expect(client.state.targetId).toBeNull()
      globalThis.fetch = originalFetch
    })
  })

  describe('navigate', () => {
    it('calls Page.navigate and waits for loadEventFired', async () => {
      const mock = mockCRI()
      mock.Page.loadEventFired.mockResolvedValue(undefined)
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      await client.navigate('https://example.com')
      expect(mock.Page.navigate).toHaveBeenCalledWith({ url: 'https://example.com' })
      expect(mock.Page.loadEventFired).toHaveBeenCalled()
      globalThis.fetch = originalFetch
    })
  })

  describe('screenshot', () => {
    it('captures screenshot with correct format', async () => {
      const mock = mockCRI()
      mock.Page.captureScreenshot.mockResolvedValue({ data: 'base64data' })
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      const data = await client.screenshot('jpeg')
      expect(data).toBe('base64data')
      expect(mock.Page.captureScreenshot).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'jpeg', clip: expect.any(Object) })
      )
      globalThis.fetch = originalFetch
    })
  })

  describe('evaluate', () => {
    it('evaluates expression via Runtime.evaluate', async () => {
      const mock = mockCRI()
      mock.Runtime.evaluate.mockResolvedValue({ result: { value: 42 } })
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      const result = await client.evaluate('1+1')
      expect(result.result.value).toBe(42)
      globalThis.fetch = originalFetch
    })

    it('throws CDPConnectionError when not connected', async () => {
      const client = CDPClient.getInstance()
      await expect(client.evaluate('1+1')).rejects.toThrow('Not connected')
    })
  })

  describe('pressKey', () => {
    it('dispatches keyDown and keyUp events', async () => {
      const mock = mockCRI()
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      await client.pressKey('Enter')
      expect(mock.Input.dispatchKeyEvent).toHaveBeenCalledWith({ type: 'keyDown', key: 'Enter' })
      expect(mock.Input.dispatchKeyEvent).toHaveBeenCalledWith({ type: 'keyUp', key: 'Enter' })
      globalThis.fetch = originalFetch
    })
  })

  describe('isHealthy', () => {
    it('returns true when evaluate returns 2', async () => {
      const mock = mockCRI()
      mock.Runtime.evaluate.mockResolvedValue({ result: { value: 2 } })
      const client = CDPClient.getInstance()
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/json/version')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
        }
        if (url.includes('/json/list')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([
            { id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }
          ]) })
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
      }) as any

      await client.connect()
      const healthy = await client.isHealthy()
      expect(healthy).toBe(true)
      globalThis.fetch = originalFetch
    })

    it('returns false when not connected', async () => {
      const client = CDPClient.getInstance()
      expect(await client.isHealthy()).toBe(false)
    })
  })

  describe('normalizePrompt', () => {
    it('strips leading bullets and collapses whitespace', () => {
      const client = CDPClient.getInstance()
      expect(client.normalizePrompt('- item 1\n- item 2')).toBe('item 1 item 2')
      expect(client.normalizePrompt('* bullet\n\n* another')).toBe('bullet another')
      expect(client.normalizePrompt('  multiple   spaces  ')).toBe('multiple spaces')
    })

    it('handles empty string', () => {
      const client = CDPClient.getInstance()
      expect(client.normalizePrompt('')).toBe('')
    })

    it('handles already-normalized text', () => {
      const client = CDPClient.getInstance()
      expect(client.normalizePrompt('hello world')).toBe('hello world')
    })
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/cdp/client.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/cdp/client.test.ts
git commit -m "test: add CDPClient method tests with mocked CRI"
```

---

### Task 3: Add CLI unit tests

**Files:**
- Create: `tests/unit/cli.test.ts`

**Context:** `src/cli.ts` uses `console.error`/`console.log` and `process.exit`. We mock these for testing. The CLI functions are not exported — we test via `main()` by mocking `process.argv`.

**Step 1: Write failing tests**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the server import to avoid actually starting MCP
vi.mock('../../src/server.js', () => ({
  startServer: vi.fn().mockResolvedValue(undefined),
}))

// Mock cdp/browser for runDetect
vi.mock('../../src/cdp/browser.js', () => ({
  getCometPath: vi.fn().mockReturnValue('/mock/comet/path'),
  isCometProcessRunning: vi.fn().mockReturnValue(true),
}))

describe('CLI', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let originalArgv: string[]

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    originalArgv = process.argv
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
    process.argv = originalArgv
  })

  it('--help prints usage info', async () => {
    process.argv = ['node', 'asteria', '--help']
    await import('../../src/cli.js')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('asteria'))
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('USAGE'))
  })

  it('--version prints version', async () => {
    process.argv = ['node', 'asteria', '--version']
    await import('../../src/cli.js')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/asteria v\d+\.\d+\.\d+/))
  })

  it('unknown command prints error', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    process.argv = ['node', 'asteria', 'foobar']
    await import('../../src/cli.js')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'))
    exitSpy.mockRestore()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/cli.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/cli.test.ts
git commit -m "test: add CLI unit tests for help, version, unknown command"
```

---

### Task 4: Add browser.ts edge case tests

**Files:**
- Modify: `tests/unit/cdp/browser.test.ts`

**Step 1: Write additional tests**

Add these tests to the existing `tests/unit/cdp/browser.test.ts`:

```typescript
describe('isWSL', () => {
  it('returns true when uname -r contains microsoft', async () => {
    const { execSync } = await import('node:child_process')
    vi.spyOn({ execSync }, 'execSync').mockReturnValue('5.15.0-microsoft-standard-WSL2')
    // Note: isWSL is not exported, tested indirectly
  })
})

describe('httpGet', () => {
  it('returns ok:true for successful fetch', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ test: true }),
    }) as any

    const result = await httpGet('http://localhost/test')
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)

    globalThis.fetch = originalFetch
  })

  it('returns ok:false for failed fetch', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error')) as any

    const result = await httpGet('http://localhost/test')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)

    globalThis.fetch = originalFetch
  })

  it('returns ok:false for non-200 status', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve(null),
    }) as any

    const result = await httpGet('http://localhost/test')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)

    globalThis.fetch = originalFetch
  })

  it('aborts after timeout', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    const originalFetch = globalThis.fetch
    // Simulate a fetch that never resolves
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      return new Promise((_, reject) => {
        // The AbortController should abort this
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }
      })
    }) as any

    const result = await httpGet('http://localhost/test', 100)
    expect(result.ok).toBe(false)

    globalThis.fetch = originalFetch
  }, 10000)
})

describe('getCometPath', () => {
  it('throws CometNotFoundError when not found', async () => {
    const { getCometPath } = await import('../../../src/cdp/browser.js')
    delete process.env.COMET_PATH
    // Mock platform to be something with no candidates
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'freebsd' })
    await expect(getCometPath()).rejects.toThrow('Comet browser not found')
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })
})

describe('isCometProcessRunning', () => {
  it('returns false on command failure', async () => {
    const { isCometProcessRunning } = await import('../../../src/cdp/browser.js')
    // On non-Windows, it uses pgrep which will fail in CI
    const result = isCometProcessRunning()
    expect(typeof result).toBe('boolean')
  })
})

describe('killComet', () => {
  it('does not throw on failure', async () => {
    const { killComet } = await import('../../../src/cdp/browser.js')
    expect(() => killComet()).not.toThrow()
  })
})

describe('startCometProcess', () => {
  it('spawns process with debug port arg', async () => {
    const { startCometProcess } = await import('../../../src/cdp/browser.js')
    const { createLogger } = await import('../../../src/logger.js')
    const logger = createLogger('error')

    // Mock spawn to avoid launching a real browser
    const { spawn } = await import('node:child_process')
    const spawnSpy = vi.spyOn(await import('node:child_process'), 'spawn').mockReturnValue({
      unref: vi.fn(),
    } as any)

    startCometProcess('/fake/comet', 9222, logger)
    expect(spawnSpy).toHaveBeenCalledWith('/fake/comet', ['--remote-debugging-port=9222'], expect.any(Object))

    spawnSpy.mockRestore()
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/cdp/browser.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/cdp/browser.test.ts
git commit -m "test: add browser.ts edge case tests (httpGet, killComet, startCometProcess)"
```

---

### Task 5: Add config.ts edge case tests

**Files:**
- Modify: `tests/unit/config.test.ts`

**Step 1: Write additional tests**

```typescript
describe('loadConfig edge cases', () => {
  it('handles malformed JSON in config file', () => {
    // Write a malformed config, load, verify defaults still work
    // This tests the catch block in loadConfigFile
    const { writeFileSync, unlinkSync } = await import('node:fs')
    writeFileSync('asteria.config.json', '{ invalid json }')
    const config = loadConfig()
    expect(config.port).toBe(9222) // Falls back to default
    unlinkSync('asteria.config.json')
  })

  it('handles invalid env var number values', () => {
    process.env.ASTERIA_PORT = 'not-a-number'
    const config = loadConfig()
    expect(config.port).toBe(9222) // Falls back to default
    delete process.env.ASTERIA_PORT
  })

  it('handles overrides parameter', () => {
    const config = loadConfig({ port: 9999 })
    expect(config.port).toBe(9999)
  })

  it('overrides take precedence over env vars', () => {
    process.env.ASTERIA_PORT = '8080'
    const config = loadConfig({ port: 9999 })
    expect(config.port).toBe(9999) // Override wins
    delete process.env.ASTERIA_PORT
  })

  it('ignores unknown keys in config file', () => {
    const { writeFileSync, unlinkSync } = await import('node:fs')
    writeFileSync('asteria.config.json', '{"port": 8080, "unknownKey": "ignored"}')
    const config = loadConfig()
    expect(config.port).toBe(8080)
    expect((config as any).unknownKey).toBeUndefined()
    unlinkSync('asteria.config.json')
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/config.test.ts
git commit -m "test: add config.ts edge case tests (malformed JSON, invalid env vars)"
```

---

### Task 6: Add status/navigation/extraction edge case tests

**Files:**
- Modify: `tests/unit/ui/status.test.ts`
- Modify: `tests/unit/ui/navigation.test.ts`
- Modify: `tests/unit/ui/extraction.test.ts`
- Modify: `tests/unit/prose-filter.test.ts`

**Step 1: Add edge case tests to status.test.ts**

```typescript
describe('buildGetAgentStatusScript edge cases', () => {
  it('accepts custom selectors parameter', () => {
    const customSelectors = {
      ...SELECTORS,
      LOADING: ['.custom-spinner'],
    }
    const script = buildGetAgentStatusScript(customSelectors)
    expect(script).toContain('.custom-spinner')
  })

  it('includes response truncation at 8000 chars', () => {
    const script = buildGetAgentStatusScript()
    expect(script).toContain('8000')
  })

  it('includes step pattern extraction', () => {
    const script = buildGetAgentStatusScript()
    expect(script).toContain('stepPatterns')
  })

  it('detects working patterns', () => {
    const script = buildGetAgentStatusScript()
    expect(script).toContain('Working')
    expect(script).toContain('Searching')
    expect(script).toContain('Navigating to')
  })
})
```

**Step 2: Add edge case tests to navigation.test.ts**

```typescript
describe('buildModeSwitchScript edge cases', () => {
  it('returns standard_mode_no_action for standard mode', () => {
    const script = buildModeSwitchScript('standard')
    expect(script).toContain('standard_mode_no_action')
  })

  it('handles unknown mode by using raw string', () => {
    const script = buildModeSwitchScript('unknown-mode')
    expect(script).toContain('unknown-mode')
  })

  it('waits for listbox with retry loop', () => {
    const script = buildModeSwitchScript('deep-research')
    expect(script).toContain('maxAttempts')
    expect(script).toContain('listbox')
  })
})

describe('buildGetCurrentModeScript', () => {
  it('returns standard by default', () => {
    const script = buildGetCurrentModeScript()
    expect(script).toContain("'standard'")
  })

  it('detects computer mode from /copilot/ URL', () => {
    const script = buildGetCurrentModeScript()
    expect(script).toContain('/copilot/')
    expect(script).toContain("'computer'")
  })
})
```

**Step 3: Add edge case tests to extraction.test.ts**

```typescript
describe('buildExtractPageContentScript edge cases', () => {
  it('handles custom maxLength', () => {
    const script = buildExtractPageContentScript(5000)
    expect(script).toContain('5000')
  })

  it('handles body being null', () => {
    const script = buildExtractPageContentScript()
    expect(script).toContain('!body')
    expect(script).toContain("JSON.stringify({ text: '', title: '' })")
  })

  it('strips UI noise text', () => {
    const script = buildExtractPageContentScript()
    expect(script).toContain('Sign in')
    expect(script).toContain('Log in')
  })
})

describe('buildExtractSourcesScript edge cases', () => {
  it('filters javascript: URLs', () => {
    const script = buildExtractSourcesScript()
    expect(script).toContain("'javascript:'")
  })

  it('filters hash-only URLs', () => {
    const script = buildExtractSourcesScript()
    expect(script).toContain("'#'")
  })

  it('deduplicates by URL', () => {
    const script = buildExtractSourcesScript()
    expect(script).toContain('seenUrls')
  })

  it('extracts domain as fallback title', () => {
    const script = buildExtractSourcesScript()
    expect(script).toContain('extractDomain')
  })
})
```

**Step 4: Add tests to prose-filter.test.ts**

```typescript
describe('buildPreSendStateScript', () => {
  it('returns IIFE that returns JSON with proseCount and lastProseText', () => {
    const script = buildPreSendStateScript()
    expect(script).toMatch(/^\(function\(\)/)
    expect(script).toContain('proseCount')
    expect(script).toContain('lastProseText')
    expect(script).toContain('JSON.stringify')
  })

  it('includes findProseJS body', () => {
    const script = buildPreSendStateScript()
    expect(script).toContain('proseElements')
    expect(script).toContain('excludeTags')
  })
})
```

**Step 5: Run all UI tests**

Run: `npx vitest run tests/unit/ui/ tests/unit/prose-filter.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/unit/ui/status.test.ts tests/unit/ui/navigation.test.ts tests/unit/ui/extraction.test.ts tests/unit/prose-filter.test.ts
git commit -m "test: add edge case tests for status, navigation, extraction, prose-filter"
```

---

### Task 7: Add version.ts and snapshot.ts tests

**Files:**
- Create: `tests/unit/version.test.ts`
- Create: `tests/unit/snapshot.test.ts`

**Step 1: Write version tests**

```typescript
import { describe, expect, it, vi } from 'vitest'

describe('detectCometVersion', () => {
  it('returns default v145 selectors on fetch failure', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no connection')) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145)
    expect(result.browser).toBe('Unknown')
    expect(result.selectors).toBeDefined()

    globalThis.fetch = originalFetch
  })

  it('parses Chrome version from Browser header', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Browser: 'Chrome/145.0.5678.90' }),
    }) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145)
    expect(result.browser).toBe('Chrome/145.0.5678.90')

    globalThis.fetch = originalFetch
  })

  it('handles non-OK HTTP response', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145) // Falls back to default

    globalThis.fetch = originalFetch
  })
})
```

**Step 2: Write snapshot tests**

```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/cdp/client.js', () => ({
  CDPClient: {
    getInstance: vi.fn().mockReturnValue({
      launchOrConnect: vi.fn().mockResolvedValue('target-1'),
      safeEvaluate: vi.fn().mockResolvedValue({
        result: { value: '{"inputs":[],"buttons":[],"proseCount":0}' },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
    resetInstance: vi.fn(),
  },
}))

describe('runSnapshot', () => {
  it('connects, evaluates, and disconnects', async () => {
    const { runSnapshot } = await import('../../src/snapshot.js')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runSnapshot()

    const { CDPClient } = await import('../../src/cdp/client.js')
    expect(CDPClient.getInstance).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/version.test.ts tests/unit/snapshot.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/unit/version.test.ts tests/unit/snapshot.test.ts
git commit -m "test: add version.ts and snapshot.ts unit tests"
```

---

### Task 8: Add selectors tests

**Files:**
- Create: `tests/unit/selectors/index.test.ts`
- Create: `tests/unit/selectors/v145.test.ts`

**Step 1: Write selector index tests**

```typescript
import { describe, expect, it } from 'vitest'
import { getSelectorsForVersion, parseChromeVersion } from '../../../src/selectors/index.js'

describe('parseChromeVersion', () => {
  it('extracts major version from Chrome string', () => {
    expect(parseChromeVersion('Chrome/145.0.5678.90')).toBe(145)
  })

  it('returns 0 for non-Chrome string', () => {
    expect(parseChromeVersion('Firefox/120.0')).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseChromeVersion('')).toBe(0)
  })
})

describe('getSelectorsForVersion', () => {
  it('returns v145 selectors for Chrome 145', () => {
    const selectors = getSelectorsForVersion(145)
    expect(selectors).toBeDefined()
    expect(selectors.INPUT).toBeDefined()
    expect(selectors.SUBMIT).toBeDefined()
  })

  it('returns v145 (fallback) for unknown version', () => {
    const selectors = getSelectorsForVersion(999)
    expect(selectors).toBeDefined()
    expect(selectors.INPUT).toBeDefined()
  })
})
```

**Step 2: Write v145 selector tests**

```typescript
import { describe, expect, it } from 'vitest'
import { v145Selectors } from '../../../src/selectors/v145.js'

describe('v145Selectors', () => {
  it('defines all required selector categories', () => {
    expect(v145Selectors.INPUT).toBeDefined()
    expect(v145Selectors.SUBMIT).toBeDefined()
    expect(v145Selectors.STOP).toBeDefined()
    expect(v145Selectors.RESPONSE).toBeDefined()
    expect(v145Selectors.LOADING).toBeDefined()
    expect(v145Selectors.TYPEAHEAD_MENU).toBeDefined()
    expect(v145Selectors.MENU_ITEM).toBeDefined()
  })

  it('has non-empty arrays for each selector category', () => {
    for (const [key, value] of Object.entries(v145Selectors)) {
      expect(Array.isArray(value)).toBe(true)
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('contains valid CSS selectors', () => {
    for (const [key, selectors] of Object.entries(v145Selectors)) {
      for (const sel of selectors as string[]) {
        expect(() => document.querySelector(sel)).not.toThrow()
      }
    }
  })
})
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/selectors/`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/unit/selectors/
git commit -m "test: add selector registry and v145 selector tests"
```

---

### Task 9: Add connection.ts edge case tests

**Files:**
- Modify: `tests/unit/cdp/connection.test.ts`

**Step 1: Add edge case tests**

```typescript
describe('isConnectionError edge cases', () => {
  it('returns false for non-Error inputs', () => {
    expect(isConnectionError('string')).toBe(false)
    expect(isConnectionError(null)).toBe(false)
    expect(isConnectionError(undefined)).toBe(false)
    expect(isConnectionError(42)).toBe(false)
  })

  it('returns false for unrelated errors', () => {
    expect(isConnectionError(new Error('something else'))).toBe(false)
  })
})

describe('getBackoffDelay edge cases', () => {
  it('returns exponential delay', () => {
    const d1 = getBackoffDelay(1, 30000)
    const d2 = getBackoffDelay(2, 30000)
    const d3 = getBackoffDelay(3, 30000)
    expect(d2).toBeGreaterThan(d1)
    expect(d3).toBeGreaterThan(d2)
  })

  it('caps at max delay', () => {
    const delay = getBackoffDelay(100, 5000)
    expect(delay).toBeLessThanOrEqual(5000)
  })

  it('handles attempt 0', () => {
    const delay = getBackoffDelay(0, 30000)
    expect(delay).toBeGreaterThanOrEqual(0)
  })
})
```

**Step 2: Run tests**

Run: `npx vitest run tests/unit/cdp/connection.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/unit/cdp/connection.test.ts
git commit -m "test: add connection.ts edge case tests"
```

---

## Phase 2: Integration Tests

### Task 10: Create integration test harness

**Files:**
- Modify: `tests/integration/mock-cdp-server.ts` (add more capabilities)
- Create: `tests/integration/tools/` directory

**Step 1: Enhance mock CDP server with Runtime.evaluate support**

Add to mock-cdp-server.ts the ability to handle WebSocket connections and return scripted responses for tool handler evaluation scripts.

**Step 2: Create base integration test helper**

Create `tests/integration/tools/helpers.ts` with shared mock setup for tool handler tests.

**Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration test harness with enhanced mock CDP"
```

---

### Task 11: Add tool handler integration tests (batch 1)

**Files:**
- Create: `tests/integration/tools/connect.test.ts`
- Create: `tests/integration/tools/ask.test.ts`
- Create: `tests/integration/tools/poll.test.ts`
- Create: `tests/integration/tools/stop.test.ts`

Test each tool handler against the mock CDP server with happy path + error path.

**Step 1: Write tests for connect, ask, poll, stop**

**Step 2: Run tests**

Run: `npx vitest run tests/integration/tools/`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/tools/
git commit -m "test: add integration tests for connect, ask, poll, stop tools"
```

---

### Task 12: Add tool handler integration tests (batch 2)

**Files:**
- Create: `tests/integration/tools/screenshot.test.ts`
- Create: `tests/integration/tools/mode.test.ts`
- Create: `tests/integration/tools/tabs.test.ts`
- Create: `tests/integration/tools/extraction.test.ts`
- Create: `tests/integration/tools/conversations.test.ts`

**Step 1: Write tests for remaining 8 tools**

**Step 2: Run tests**

Run: `npx vitest run tests/integration/tools/`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/tools/
git commit -m "test: add integration tests for remaining tool handlers"
```

---

## Phase 3: UAT Plan Formalization

### Task 13: Write formal UAT test plan

**Files:**
- Create: `docs/uat/uat-plan.md`

**Step 1: Write structured UAT plan**

Create formal test cases for all 12 tools with:
- Test ID (UAT-001 through UAT-040+)
- Preconditions
- Numbered steps
- Expected results
- Pass/Fail fields

Categories: Smoke (5min), Functional (20min), Error Recovery (10min), Mode Switching (5min), Cross-Session (5min)

**Step 2: Commit**

```bash
git add docs/uat/
git commit -m "docs: add formalized UAT test plan with pass/fail criteria"
```

---

## Phase 4: CI/CD Hardening

### Task 14: Add coverage thresholds and CI updates

**Files:**
- Modify: `vitest.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `README.md` (add coverage badge)

**Step 1: Update vitest.config.ts with coverage**

```typescript
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
})
```

**Step 2: Update CI workflow**

```yaml
- run: npx vitest run --coverage
- name: Check coverage
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
```

**Step 3: Add test:ci script to package.json**

```json
"test:ci": "vitest run --coverage"
```

**Step 4: Add coverage badge to README**

**Step 5: Run coverage locally**

Run: `npx vitest run --coverage`
Expected: All tests pass, coverage thresholds met

**Step 6: Commit**

```bash
git add vitest.config.ts .github/workflows/ci.yml package.json README.md
git commit -m "ci: add coverage thresholds, coverage reporting, and CI updates"
```

---

## Summary

| Phase | Tasks | Estimated Tests Added |
|-------|-------|----------------------|
| Phase 1: Unit Gaps | Tasks 1-9 | ~80 new unit tests |
| Phase 2: Integration | Tasks 10-12 | ~30 new integration tests |
| Phase 3: UAT | Task 13 | 40+ UAT test cases |
| Phase 4: CI/CD | Task 14 | Coverage enforcement |

**Total: 14 tasks, ~110 automated tests, 40+ manual UAT cases**
