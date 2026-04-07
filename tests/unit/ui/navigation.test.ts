import { describe, expect, it } from 'vitest'
import {
  buildGetCurrentModeScript,
  buildModeSwitchScript,
  buildNewChatScript,
  buildSubmitPromptScript,
} from '../../../src/ui/navigation.js'

describe('buildSubmitPromptScript', () => {
  it('generates multi-strategy submit', () => {
    const s = buildSubmitPromptScript()
    expect(s).toContain('Enter')
  })
})

describe('buildGetCurrentModeScript', () => {
  it('returns standard mode by default', () => {
    const s = buildGetCurrentModeScript()
    expect(s).toContain('standard')
    expect(s).toContain('/copilot/')
  })
})

describe('buildModeSwitchScript', () => {
  it('generates slash-command based mode switch for deep-research', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toContain('Deep research')
    expect(s).toContain('/')
    expect(s).toContain('[role="listbox"]')
    expect(s).toContain('[role="menuitem"]')
  })

  it('generates slash-command based mode switch for computer', () => {
    const s = buildModeSwitchScript('computer')
    expect(s).toContain('Computer')
    expect(s).toContain('#ask-input')
    expect(s).toContain('[contenteditable="true"]')
  })

  it('handles create mode correctly', () => {
    const s = buildModeSwitchScript('create')
    expect(s).toContain('Create files and apps')
  })

  it('handles learn mode correctly', () => {
    const s = buildModeSwitchScript('learn')
    expect(s).toContain('Learn step by step')
  })

  it('returns no_action for standard mode', () => {
    const s = buildModeSwitchScript('standard')
    expect(s).toContain('standard_mode_no_action')
  })

  // Edge case tests
  it('returns standard_mode_no_action for standard mode', () => {
    const s = buildModeSwitchScript('standard')
    expect(s).toContain('standard_mode_no_action')
  })

  it('uses raw string for unknown mode', () => {
    const s = buildModeSwitchScript('unknown-custom-mode')
    expect(s).toContain('unknown-custom-mode')
  })

  it('has listbox retry with maxAttempts', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toContain('maxAttempts')
    expect(s).toContain('attempts')
    expect(s).toContain('setTimeout')
  })
})

describe('buildNewChatScript', () => {
  it('navigates to perplexity.ai', () => {
    const s = buildNewChatScript()
    expect(s).toContain('perplexity.ai')
  })
})

describe('buildGetCurrentModeScript edge cases', () => {
  it('returns standard by default', () => {
    const s = buildGetCurrentModeScript()
    expect(s).toContain("return 'standard'")
  })

  it('detects computer mode from /copilot/ URL', () => {
    const s = buildGetCurrentModeScript()
    expect(s).toContain('/copilot/')
    expect(s).toContain("return 'computer'")
  })
})
