import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for runDetect() and runCall() from src/cli.ts.
 *
 * Since these functions are not exported and main() is called at import time,
 * we control process.argv + mock process.exit + mock child_process to test
 * the internal logic.
 */

// Capture console output
let consoleOutput: string[] = []
const originalConsoleError = console.error
const originalConsoleLog = console.log
const originalExit = process.exit

function captureConsole() {
  consoleOutput = []
  console.error = (...args: any[]) => {
    consoleOutput.push(args.map(String).join(' '))
  }
  console.log = (...args: any[]) => {
    consoleOutput.push(args.map(String).join(' '))
  }
}

function restoreConsole() {
  console.error = originalConsoleError
  console.log = originalConsoleLog
}

// Mock child_process.spawn for runCall tests
const mockStdin = {
  write: vi.fn(),
  end: vi.fn(),
}
const mockStdout = {
  on: vi.fn(),
}
const mockStderr = {
  on: vi.fn(),
}
const mockChild = {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
  kill: vi.fn(),
}

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockReturnValue(mockChild),
}))

// Mock cdp/browser for runDetect
vi.mock('../../src/cdp/browser.js', () => ({
  getCometPath: vi.fn().mockReturnValue('/usr/bin/comet'),
  isCometProcessRunning: vi.fn().mockReturnValue(true),
  startCometProcess: vi.fn(),
  killComet: vi.fn(),
  httpGet: vi.fn(),
}))

// Mock server for 'start' command
vi.mock('../../src/server.js', () => ({
  startServer: vi.fn(),
}))

describe('CLI runDetect', () => {
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    captureConsole()
    exitCode = undefined
    // Use a non-throwing process.exit mock
    process.exit = ((code: number) => { exitCode = code }) as any
    mockStdin.write.mockClear()
    mockStdout.on.mockClear()
    mockStderr.on.mockClear()
    mockChild.on.mockClear()
  })

  afterEach(() => {
    restoreConsole()
    process.exit = originalExit
    vi.resetModules()
  })

  it('detects Comet running and path found', async () => {
    const { getCometPath, isCometProcessRunning } = await import('../../src/cdp/browser.js')
    vi.mocked(getCometPath).mockReturnValue('/Applications/Comet.app/Contents/MacOS/comet')
    vi.mocked(isCometProcessRunning).mockReturnValue(true)

    // Mock fetch for debug port check
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Browser: 'Chrome/145.0.0.0' }),
    }) as any

    // Set argv to trigger detect command
    process.argv = ['node', 'cli.js', 'detect']

    // Import cli — this will call main() which calls runDetect()
    await import('../../src/cli.js')

    const output = consoleOutput.join('\n')
    expect(output).toContain('running')
    expect(output).toContain('/Applications/Comet.app')

    globalThis.fetch = origFetch
  })

  it('handles Comet path not found', async () => {
    const { getCometPath, isCometProcessRunning } = await import('../../src/cdp/browser.js')
    vi.mocked(getCometPath).mockImplementation(() => { throw new Error('Not found') })
    vi.mocked(isCometProcessRunning).mockReturnValue(false)

    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused')) as any

    process.argv = ['node', 'cli.js', 'detect']
    await import('../../src/cli.js')

    const output = consoleOutput.join('\n')
    expect(output).toContain('not running')
    expect(output).toContain('NOT FOUND')

    globalThis.fetch = origFetch
  })
})

describe('CLI runCall', () => {
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    captureConsole()
    exitCode = undefined
    process.exit = ((code: number) => { exitCode = code }) as any
    mockStdin.write.mockClear()
    mockStdout.on.mockClear()
    mockStderr.on.mockClear()
    mockChild.on.mockClear()
  })

  afterEach(() => {
    restoreConsole()
    process.exit = originalExit
    vi.resetModules()
  })

  it('missing tool name shows usage and exits', async () => {
    process.argv = ['node', 'cli.js', 'call']
    await import('../../src/cli.js')

    expect(exitCode).toBe(1)
    const output = consoleOutput.join('\n')
    expect(output).toContain('Usage: asteria call')
  })

  it('unknown tool shows error and exits', async () => {
    process.argv = ['node', 'cli.js', 'call', 'unknown_tool']
    await import('../../src/cli.js')

    expect(exitCode).toBe(1)
    const output = consoleOutput.join('\n')
    expect(output).toContain('Unknown tool: unknown_tool')
  })

  it('invalid JSON shows error and exits', async () => {
    process.argv = ['node', 'cli.js', 'call', 'comet_connect', 'not-json']
    await import('../../src/cli.js')

    expect(exitCode).toBe(1)
    const output = consoleOutput.join('\n')
    expect(output).toContain('Invalid JSON')
  })

  it('sends JSON-RPC initialize message via stdin', async () => {
    process.argv = ['node', 'cli.js', 'call', 'comet_connect', '{"port": 9223}']

    // Track stdin writes
    const stdinWrites: string[] = []
    mockStdin.write.mockImplementation((data: string) => {
      stdinWrites.push(data.trim())
    })

    // Set up stdout handler to simulate MCP responses
    mockStdout.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
      if (event === 'data') {
        // Simulate initialize response
        const initResp = JSON.stringify({ jsonrpc: '2.0', id: 0, result: { capabilities: {} } })
        // Simulate tool response
        const toolResp = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: 'Connected to Comet on port 9223' }],
          },
        })
        // Send responses asynchronously
        setTimeout(() => {
          cb(Buffer.from(initResp + '\n'))
          setTimeout(() => {
            cb(Buffer.from(toolResp + '\n'))
          }, 10)
        }, 10)
      }
    })

    await import('../../src/cli.js')

    // Wait for async operations
    await new Promise((r) => setTimeout(r, 200))

    // Should have written initialize message to stdin
    expect(stdinWrites.length).toBeGreaterThanOrEqual(1)
    const initMsg = JSON.parse(stdinWrites[0])
    expect(initMsg.jsonrpc).toBe('2.0')
    expect(initMsg.method).toBe('initialize')
    expect(initMsg.params.protocolVersion).toBe('2024-11-05')
  })

  it('constructs correct tool/call JSON-RPC message', async () => {
    process.argv = ['node', 'cli.js', 'call', 'comet_ask', '{"prompt": "test"}']

    const stdinWrites: string[] = []
    mockStdin.write.mockImplementation((data: string) => {
      stdinWrites.push(data.trim())
    })

    let responded = false
    mockStdout.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
      if (event === 'data' && !responded) {
        const initResp = JSON.stringify({ jsonrpc: '2.0', id: 0, result: {} })
        setTimeout(() => {
          cb(Buffer.from(initResp + '\n'))
          // After initialized notification, send tool response
          setTimeout(() => {
            const toolResp = JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: { content: [{ type: 'text', text: 'Response text' }] },
            })
            cb(Buffer.from(toolResp + '\n'))
            responded = true
          }, 10)
        }, 10)
      }
    })

    await import('../../src/cli.js')
    await new Promise((r) => setTimeout(r, 300))

    // Find the tool/call message
    const toolMsg = stdinWrites.find((w) => {
      try {
        const parsed = JSON.parse(w)
        return parsed.method === 'tools/call'
      } catch { return false }
    })

    expect(toolMsg).toBeDefined()
    const parsed = JSON.parse(toolMsg!)
    expect(parsed.params.name).toBe('comet_ask')
    expect(parsed.params.arguments.prompt).toBe('test')
  })

  it('handles error response from server', async () => {
    process.argv = ['node', 'cli.js', 'call', 'comet_connect']

    mockStdout.on.mockImplementation((event: string, cb: (d: Buffer) => void) => {
      if (event === 'data') {
        const initResp = JSON.stringify({ jsonrpc: '2.0', id: 0, result: {} })
        setTimeout(() => {
          cb(Buffer.from(initResp + '\n'))
          setTimeout(() => {
            const errResp = JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              error: { code: -32603, message: 'Internal error' },
            })
            cb(Buffer.from(errResp + '\n'))
          }, 10)
        }, 10)
      }
    })

    await import('../../src/cli.js')
    await new Promise((r) => setTimeout(r, 300))

    const output = consoleOutput.join('\n')
    expect(output).toContain('Error')
  })
})

describe('CLI unknown command', () => {
  let exitCode: number | undefined

  beforeEach(() => {
    captureConsole()
    exitCode = undefined
    process.exit = ((code: number) => { exitCode = code }) as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    restoreConsole()
    process.exit = originalExit
    vi.resetModules()
  })

  it('unknown command exits with error', async () => {
    process.argv = ['node', 'cli.js', 'foobar']
    await import('../../src/cli.js')

    expect(exitCode).toBe(1)
    const output = consoleOutput.join('\n')
    expect(output).toContain('Unknown command')
  })
})
