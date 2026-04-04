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
})

describe('buildNewChatScript', () => {
  it('navigates to perplexity.ai', () => {
    const s = buildNewChatScript()
    expect(s).toContain('perplexity.ai')
  })
})
