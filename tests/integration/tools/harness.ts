/**
 * Shared integration test harness for MCP tool handler tests.
 *
 * Strategy: Mock McpServer to capture handler functions during startServer(),
 * then call them directly with controlled CDPClient mocks.
 */
import { vi } from 'vitest'
import type { CometConfig } from '../../../src/types.js'

// ---------------------------------------------------------------------------
// Captured tool handlers (populated by mock McpServer during startServer())
// ---------------------------------------------------------------------------
export const capturedHandlers: Record<string, (...args: any[]) => Promise<any>> = {}

// ---------------------------------------------------------------------------
// Mock CDPClient methods — each test file can override these per-test
// ---------------------------------------------------------------------------
export const mocks = {
  launchOrConnect: vi.fn<() => Promise<string>>().mockResolvedValue('target-1'),
  closeExtraTabs: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  connect: vi.fn<(id?: string) => Promise<string>>().mockResolvedValue('target-1'),
  navigate: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
  screenshot: vi.fn<(fmt?: string) => Promise<string>>().mockResolvedValue('base64data'),
  safeEvaluate: vi.fn<(expr: string) => Promise<{ result?: { value?: unknown }; exceptionDetails?: unknown }>>()
    .mockResolvedValue({ result: { value: '{}' } }),
  listTargets: vi.fn<() => Promise<any[]>>().mockResolvedValue([
    { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
  ]),
  listTabsCategorized: vi.fn<() => Promise<any>>().mockResolvedValue({
    main: [{ id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' }],
    sidecar: [],
    agentBrowsing: [],
    overlay: [],
    others: [],
  }),
  pressKey: vi.fn<(key: string) => Promise<void>>().mockResolvedValue(undefined),
  typeChar: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
  pressKeyWithModifier: vi.fn<(key: string, modifier: number) => Promise<void>>().mockResolvedValue(undefined),
  normalizePrompt: vi.fn<(s: string) => string>().mockImplementation((s: string) =>
    s.replace(/^[-*]\s+/gm, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim(),
  ),
  state: {
    connected: true,
    port: 9222,
    targetId: 'target-1',
    reconnectAttempts: 0,
    isReconnecting: false,
  },
}

// Reset all mocks and captured handlers between tests
export function resetHarness(): void {
  Object.values(mocks).forEach((m) => {
    if (typeof m === 'object' && m !== mocks.state) {
      // Don't reset state
      if ('mockClear' in m) (m as any).mockClear()
    }
  })
  // Reset mock implementations to defaults
  mocks.launchOrConnect.mockResolvedValue('target-1')
  mocks.closeExtraTabs.mockResolvedValue(undefined)
  mocks.disconnect.mockResolvedValue(undefined)
  mocks.connect.mockResolvedValue('target-1')
  mocks.navigate.mockResolvedValue(undefined)
  mocks.screenshot.mockResolvedValue('base64data')
  mocks.safeEvaluate.mockResolvedValue({ result: { value: '{}' } })
  mocks.listTargets.mockResolvedValue([
    { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
  ])
  mocks.listTabsCategorized.mockResolvedValue({
    main: [{ id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' }],
    sidecar: [],
    agentBrowsing: [],
    overlay: [],
    others: [],
  })
  mocks.state.connected = true
  mocks.state.port = 9222
  mocks.state.targetId = 'target-1'
}

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any imports
// ---------------------------------------------------------------------------

// Capture McpServer tool registrations
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class MockMcpServer {
      tool(name: string, _desc: string, _schema: any, handler: (...args: any[]) => Promise<any>) {
        capturedHandlers[name] = handler
      }
      async connect() {}
    },
  }
})

// Prevent stdio transport from actually connecting
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {},
}))

// Mock CDPClient to return our controllable mock
vi.mock('../../../src/cdp/client.js', () => ({
  CDPClient: {
    getInstance: () => mocks,
  },
}))

// Mock config to avoid loading real config files
vi.mock('../../../src/config.js', () => ({
  loadConfig: (): CometConfig => ({
    port: 9222,
    timeout: 30000,
    cometPath: null,
    responseTimeout: 5000,
    logLevel: 'error',
    screenshotFormat: 'png',
    screenshotQuality: 80,
    windowWidth: 1440,
    windowHeight: 900,
    maxReconnectAttempts: 5,
    maxReconnectDelay: 5000,
    pollInterval: 100,
  }),
}))

// Mock detectCometVersion
vi.mock('../../../src/version.js', () => ({
  detectCometVersion: vi.fn().mockResolvedValue({
    chromeMajor: 145,
    browser: 'Chrome/145.0.0.0',
    selectors: {
      INPUT: ['[contenteditable="true"]'],
      SUBMIT: ['button[type="submit"]'],
      STOP: ['button[aria-label*="stop"]'],
      RESPONSE: ['[class*="prose"]'],
      LOADING: ['[class*="loading"]'],
      TYPEAHEAD_MENU: ['[role="listbox"]'],
      MENU_ITEM: ['[role="menuitem"]'],
    },
  }),
}))

/**
 * Call startServer() to register all tool handlers, then return the captured handlers.
 * Call this once in a beforeAll() block.
 */
export async function registerHandlers(): Promise<void> {
  // Clear any previous captures
  for (const key of Object.keys(capturedHandlers)) {
    delete capturedHandlers[key]
  }
  const { startServer } = await import('../../../src/server.js')
  await startServer()
}

/**
 * Get a captured handler by tool name.
 */
export function getHandler(name: string): (...args: any[]) => Promise<any> {
  const handler = capturedHandlers[name]
  if (!handler) throw new Error(`Handler not found: ${name}. Available: ${Object.keys(capturedHandlers).join(', ')}`)
  return handler
}
