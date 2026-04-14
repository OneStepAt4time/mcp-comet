import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/cdp/client.js', () => ({
  CDPClient: {
    getInstance: vi.fn(),
  },
}))

vi.mock('../../../src/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    level: 'info',
  })),
}))

describe('toolDefinitions', () => {
  it('has 14 tools with correct names', async () => {
    const { toolDefinitions } = await import('../../../src/server.js')
    expect(toolDefinitions).toHaveLength(14)
    const names = toolDefinitions.map((t) => t.name)
    expect(names).toContain('comet_connect')
    expect(names).toContain('comet_ask')
    expect(names).toContain('comet_poll')
    expect(names).toContain('comet_stop')
    expect(names).toContain('comet_screenshot')
    expect(names).toContain('comet_mode')
    expect(names).toContain('comet_list_tabs')
    expect(names).toContain('comet_switch_tab')
    expect(names).toContain('comet_get_sources')
    expect(names).toContain('comet_list_conversations')
    expect(names).toContain('comet_open_conversation')
    expect(names).toContain('comet_get_page_content')
    expect(names).toContain('comet_wait')
  })

  it('each tool has required fields', async () => {
    const { toolDefinitions } = await import('../../../src/server.js')
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('comet_ask requires prompt', async () => {
    const { toolDefinitions } = await import('../../../src/server.js')
    const ask = toolDefinitions.find((t) => t.name === 'comet_ask')
    expect(ask?.inputSchema.required).toContain('prompt')
  })

  it('comet_open_conversation requires url', async () => {
    const { toolDefinitions } = await import('../../../src/server.js')
    const open = toolDefinitions.find((t) => t.name === 'comet_open_conversation')
    expect(open?.inputSchema.required).toContain('url')
  })
})
