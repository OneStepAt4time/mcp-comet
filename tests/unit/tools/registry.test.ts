import { describe, expect, it } from 'vitest'
import { toolDefinitions } from '../../../src/server.js'

describe('toolDefinitions', () => {
  it('has 13 tools', () => {
    expect(toolDefinitions).toHaveLength(13)
  })

  it('has all expected names', () => {
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

  it('each tool has name, description, inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('comet_ask requires prompt', () => {
    // biome-ignore lint/style/noNonNullAssertion: test fixture always has comet_ask
    const ask = toolDefinitions.find((t) => t.name === 'comet_ask')!
    expect(ask.inputSchema.required).toContain('prompt')
    expect(ask.inputSchema.properties.prompt.type).toBe('string')
  })

  it('comet_mode accepts optional mode', () => {
    // biome-ignore lint/style/noNonNullAssertion: test fixture always has comet_mode
    const mode = toolDefinitions.find((t) => t.name === 'comet_mode')!
    expect(mode.inputSchema.required).toBeUndefined()
  })
})
