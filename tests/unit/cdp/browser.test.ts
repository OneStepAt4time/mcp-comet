import { createServer, type Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('getCometPath', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns COMET_PATH env var when set', async () => {
    vi.stubEnv('COMET_PATH', '/custom/path/comet.exe')
    const { getCometPath } = await import('../../../src/cdp/browser.js')
    expect(getCometPath()).toBe('/custom/path/comet.exe')
  })

  it('throws CometNotFoundError when not found', async () => {
    vi.resetModules()
    delete process.env.COMET_PATH
    const orig = process.platform
    Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })
    const { getCometPath } = await import('../../../src/cdp/browser.js')
    expect(() => getCometPath()).toThrow('Comet browser not found')
    Object.defineProperty(process, 'platform', { value: orig, configurable: true })
  })
})

describe('isWindows', () => {
  it('returns true on win32', async () => {
    const orig = process.platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    })
    const { isWindows, isMac } = await import('../../../src/cdp/browser.js')
    expect(isWindows()).toBe(true)
    expect(isMac()).toBe(false)
    Object.defineProperty(process, 'platform', {
      value: orig,
      configurable: true,
    })
  })
})

describe('httpGet', () => {
  it('returns ok:false for failed fetch (rejected promise)', async () => {
    const { httpGet } = await import('../../../src/cdp/browser.js')
    // Invalid URL that will fail
    const result = await httpGet('http://127.0.0.1:99999/invalid', 1000)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
  })
})

describe('httpGet with local server', () => {
  let server: Server
  let port: number

  beforeEach(async () => {
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
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as { port: number }).port
        resolve()
      })
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()) })
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

describe('isCometProcessRunning', () => {
  it('returns boolean (basic sanity check)', async () => {
    const { isCometProcessRunning } = await import('../../../src/cdp/browser.js')
    const result = isCometProcessRunning()
    expect(typeof result).toBe('boolean')
  })
})

describe('killComet', () => {
  it('does not throw on failure', async () => {
    const { killComet } = await import('../../../src/cdp/browser.js')
    // This should not throw even if no Comet process exists
    expect(() => killComet()).not.toThrow()
  })
})

describe('startCometProcess', () => {
  it('spawns process with correct debug port arg', async () => {
    const childProcess = await import('node:child_process')
    const mockChild = {
      unref: vi.fn(),
      on: vi.fn(),
      stdin: null,
      stdout: null,
      stderr: null,
    }
    const spawnMock = vi.fn().mockReturnValue(mockChild)

    // Use module mocking via vi.mock
    vi.doMock('node:child_process', () => ({
      ...childProcess,
      spawn: spawnMock,
      execSync: childProcess.execSync,
    }))

    // Clear module cache to pick up the mock
    vi.resetModules()

    const { startCometProcess } = await import('../../../src/cdp/browser.js')
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    startCometProcess('/path/to/comet', 9223, mockLogger as unknown as import('../../../src/logger.js').Logger)

    expect(spawnMock).toHaveBeenCalledWith(
      '/path/to/comet',
      ['--remote-debugging-port=9223'],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      }),
    )

    vi.doUnmock('node:child_process')
    vi.resetModules()
  })

  it('passes --user-data-dir when userDataDir is provided', async () => {
    const childProcess = await import('node:child_process')
    const mockChild = {
      unref: vi.fn(),
      on: vi.fn(),
      stdin: null,
      stdout: null,
      stderr: null,
    }
    const spawnMock = vi.fn().mockReturnValue(mockChild)

    vi.doMock('node:child_process', () => ({
      ...childProcess,
      spawn: spawnMock,
      execSync: childProcess.execSync,
    }))
    vi.resetModules()

    const { startCometProcess } = await import('../../../src/cdp/browser.js')
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    startCometProcess(
      '/path/to/comet',
      9222,
      mockLogger as unknown as import('../../../src/logger.js').Logger,
      '/custom/profile',
    )

    expect(spawnMock).toHaveBeenCalledWith(
      '/path/to/comet',
      ['--remote-debugging-port=9222', '--user-data-dir=/custom/profile'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    )

    vi.doUnmock('node:child_process')
    vi.resetModules()
  })

  it('omits --user-data-dir when userDataDir is null', async () => {
    const childProcess = await import('node:child_process')
    const mockChild = {
      unref: vi.fn(),
      on: vi.fn(),
      stdin: null,
      stdout: null,
      stderr: null,
    }
    const spawnMock = vi.fn().mockReturnValue(mockChild)

    vi.doMock('node:child_process', () => ({
      ...childProcess,
      spawn: spawnMock,
      execSync: childProcess.execSync,
    }))
    vi.resetModules()

    const { startCometProcess } = await import('../../../src/cdp/browser.js')
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    startCometProcess(
      '/path/to/comet',
      9222,
      mockLogger as unknown as import('../../../src/logger.js').Logger,
      null,
    )

    expect(spawnMock).toHaveBeenCalledWith(
      '/path/to/comet',
      ['--remote-debugging-port=9222'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    )

    vi.doUnmock('node:child_process')
    vi.resetModules()
  })

  it('attaches error handler to spawned process', async () => {
    const childProcess = await import('node:child_process')
    const mockChild = {
      unref: vi.fn(),
      on: vi.fn(),
      stdin: null,
      stdout: null,
      stderr: null,
    }
    const spawnMock = vi.fn().mockReturnValue(mockChild)

    vi.doMock('node:child_process', () => ({
      ...childProcess,
      spawn: spawnMock,
      execSync: childProcess.execSync,
    }))

    vi.resetModules()

    const { startCometProcess } = await import('../../../src/cdp/browser.js')
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    startCometProcess('/path/to/comet', 9222, mockLogger as unknown as import('../../../src/logger.js').Logger)

    expect(mockChild.on).toHaveBeenCalledWith('error', expect.any(Function))

    vi.doUnmock('node:child_process')
    vi.resetModules()
  })
})
