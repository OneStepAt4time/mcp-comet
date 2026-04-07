import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CRI from 'chrome-remote-interface'
import { CDPClient } from '../../../src/cdp/client.js'
import { CDPConnectionError } from '../../../src/errors.js'

vi.mock('chrome-remote-interface', () => ({
  default: vi.fn(),
}))

function mockCRI(overrides = {}) {
  const mock = {
    Page: {
      enable: vi.fn(),
      navigate: vi.fn(),
      loadEventFired: vi.fn().mockResolvedValue(undefined),
      captureScreenshot: vi.fn(),
    },
    Runtime: { enable: vi.fn(), evaluate: vi.fn() },
    Emulation: { setDeviceMetricsOverride: vi.fn().mockRejectedValue('ignore') },
    Input: { dispatchKeyEvent: vi.fn() },
    Target: { closeTarget: vi.fn() },
    close: vi.fn(),
    ...overrides,
  }
  vi.mocked(CRI).mockResolvedValue(mock as any)
  return mock
}

function mockFetchForConnect(
  targets = [{ id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }],
) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/json/version'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ Browser: 'Chrome/145.0.0.0' }),
      })
    if (url.includes('/json/list'))
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(targets) })
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) })
  }) as any
  return originalFetch
}

describe('CDPClient singleton', () => {
  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  it('returns same instance', () => {
    const a = CDPClient.getInstance()
    const b = CDPClient.getInstance()
    expect(a).toBe(b)
  })

  it('initializes with default state', () => {
    const client = CDPClient.getInstance()
    expect(client.state.connected).toBe(false)
    expect(client.state.targetId).toBeNull()
    expect(client.state.reconnectAttempts).toBe(0)
  })

  it('normalizePrompt strips bullets and collapses whitespace', () => {
    const client = CDPClient.getInstance()
    expect(client.normalizePrompt('- item 1\n- item 2\n- item 3')).toBe('item 1 item 2 item 3')
    expect(client.normalizePrompt('* bullet\n\n* another')).toBe('bullet another')
    expect(client.normalizePrompt('  multiple   spaces  ')).toBe('multiple spaces')
  })

  it('normalizePrompt edge cases', () => {
    const client = CDPClient.getInstance()
    // Empty string
    expect(client.normalizePrompt('')).toBe('')
    // Already-normalized text
    expect(client.normalizePrompt('already normalized text')).toBe('already normalized text')
  })
})

describe('CDPClient connect()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('connects successfully and enables Page and Runtime domains', async () => {
    originalFetch = mockFetchForConnect()
    const criMock = mockCRI()

    const client = CDPClient.getInstance()
    const targetId = await client.connect()

    expect(targetId).toBe('t1')
    expect(criMock.Page.enable).toHaveBeenCalled()
    expect(criMock.Runtime.enable).toHaveBeenCalled()
    expect(client.state.connected).toBe(true)
    expect(client.state.targetId).toBe('t1')
  })

  it('throws CDPConnectionError when no targets available', async () => {
    originalFetch = mockFetchForConnect([])

    const client = CDPClient.getInstance()
    await expect(client.connect()).rejects.toThrow(CDPConnectionError)
    await expect(client.connect()).rejects.toThrow('No suitable browser target found')
  })
})

describe('CDPClient disconnect()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('disconnects and resets state', async () => {
    originalFetch = mockFetchForConnect()
    const criMock = mockCRI()

    const client = CDPClient.getInstance()
    await client.connect()
    expect(client.state.connected).toBe(true)

    await client.disconnect()

    expect(criMock.close).toHaveBeenCalled()
    expect(client.state.connected).toBe(false)
    expect(client.state.targetId).toBeNull()
  })
})

describe('CDPClient navigate()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('navigates to URL and waits for load event', async () => {
    originalFetch = mockFetchForConnect()
    const criMock = mockCRI()

    const client = CDPClient.getInstance()
    await client.connect()

    await client.navigate('https://example.com')

    expect(criMock.Page.navigate).toHaveBeenCalledWith({ url: 'https://example.com' })
    expect(criMock.Page.loadEventFired).toHaveBeenCalled()
  })
})

describe('CDPClient screenshot()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('captures screenshot with specified format', async () => {
    originalFetch = mockFetchForConnect()
    const criMock = mockCRI({
      Page: {
        enable: vi.fn(),
        navigate: vi.fn(),
        loadEventFired: vi.fn().mockResolvedValue(undefined),
        captureScreenshot: vi.fn().mockResolvedValue({ data: 'base64data' }),
      },
    })

    const client = CDPClient.getInstance()
    await client.connect()

    const result = await client.screenshot('jpeg')

    expect(criMock.Page.captureScreenshot).toHaveBeenCalled()
    const callArgs = criMock.Page.captureScreenshot.mock.calls[0][0]
    expect(callArgs.format).toBe('jpeg')
    expect(callArgs.clip).toEqual({ x: 0, y: 0, width: 1440, height: 900, scale: 1 })
    expect(result).toBe('base64data')
  })

  it('auto-reconnects before screenshot when connection drops', async () => {
    let connectCount = 0
    originalFetch = mockFetchForConnect()

    // First CRI connection succeeds, health check fails, second connection succeeds
    let screenshotAttempted = false
    const healthyCriMock = {
      Page: {
        enable: vi.fn(),
        navigate: vi.fn(),
        loadEventFired: vi.fn().mockResolvedValue(undefined),
        captureScreenshot: vi.fn().mockResolvedValue({ data: 'screenshot-data' }),
      },
      Runtime: {
        enable: vi.fn(),
        evaluate: vi.fn().mockImplementation(() => {
          if (!screenshotAttempted) {
            // First health check passes for initial connect
            return Promise.resolve({ result: { value: 2 } })
          }
          return Promise.resolve({ result: { value: 2 } })
        }),
      },
      Emulation: { setDeviceMetricsOverride: vi.fn().mockRejectedValue('ignore') },
      Input: { dispatchKeyEvent: vi.fn() },
      Target: { closeTarget: vi.fn() },
      close: vi.fn(),
    }

    vi.mocked(CRI).mockImplementation(async () => {
      connectCount++
      return healthyCriMock as any
    })

    const client = CDPClient.getInstance()
    await client.connect()

    // Simulate connection drop
    screenshotAttempted = true
    // After disconnect, health check returns false, then reconnect succeeds
    const originalEvaluate = healthyCriMock.Runtime.evaluate
    healthyCriMock.Runtime.evaluate = vi.fn().mockImplementation(() => {
      // Return unhealthy result to trigger reconnect
      return Promise.resolve({ result: { value: null } })
    })

    // After reconnect, evaluation should succeed again
    const fetchCalls: string[] = []
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url)
      if (url.includes('/json/version'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ Browser: 'Chrome/145' }) })
      if (url.includes('/json/list'))
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 't1', url: 'https://perplexity.ai', type: 'page', title: 'P' }]) })
      return Promise.resolve({ ok: false })
    }) as any

    // screenshot() should call ensureHealthyConnection which triggers reconnect
    const result = await client.screenshot('png')

    globalThis.fetch = origFetch
    expect(result).toBe('screenshot-data')
    expect(connectCount).toBeGreaterThanOrEqual(2) // initial connect + reconnect
  })
})

describe('CDPClient evaluate()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('evaluates expression and returns result', async () => {
    originalFetch = mockFetchForConnect()
    mockCRI({
      Runtime: { enable: vi.fn(), evaluate: vi.fn().mockResolvedValue({ result: { value: 42 } }) },
    })

    const client = CDPClient.getInstance()
    await client.connect()

    const result = await client.evaluate('2 * 21')

    expect(result.result.value).toBe(42)
  })

  it('throws CDPConnectionError when not connected', async () => {
    const client = CDPClient.getInstance()

    await expect(client.evaluate('1+1')).rejects.toThrow(CDPConnectionError)
    await expect(client.evaluate('1+1')).rejects.toThrow('Not connected')
  })
})

describe('CDPClient pressKey()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('dispatches keyDown and keyUp events', async () => {
    originalFetch = mockFetchForConnect()
    const criMock = mockCRI()

    const client = CDPClient.getInstance()
    await client.connect()

    await client.pressKey('Enter')

    expect(criMock.Input.dispatchKeyEvent).toHaveBeenCalledTimes(2)
    expect(criMock.Input.dispatchKeyEvent).toHaveBeenNthCalledWith(1, { type: 'keyDown', key: 'Enter' })
    expect(criMock.Input.dispatchKeyEvent).toHaveBeenNthCalledWith(2, { type: 'keyUp', key: 'Enter' })
  })
})

describe('CDPClient isHealthy()', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    CDPClient.resetInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalFetch) globalThis.fetch = originalFetch
  })

  it('returns true when evaluation succeeds with correct value', async () => {
    originalFetch = mockFetchForConnect()
    mockCRI({
      Runtime: { enable: vi.fn(), evaluate: vi.fn().mockResolvedValue({ result: { value: 2 } }) },
    })

    const client = CDPClient.getInstance()
    await client.connect()

    const healthy = await client.isHealthy()

    expect(healthy).toBe(true)
  })

  it('returns false when not connected', async () => {
    const client = CDPClient.getInstance()

    const healthy = await client.isHealthy()

    expect(healthy).toBe(false)
  })
})
