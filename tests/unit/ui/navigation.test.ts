import { describe, expect, it } from 'vitest'
import {
  buildModeSwitchScript,
  buildNewChatScript,
  buildReadActiveModeScript,
  buildSubmitPromptScript,
} from '../../../src/ui/navigation.js'

describe('buildSubmitPromptScript', () => {
  it('generates multi-strategy submit', () => {
    const s = buildSubmitPromptScript()
    expect(s).toContain('Enter')
  })
})

describe('buildModeSwitchScript', () => {
  it('uses icon-based matching for deep-research', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toContain('#pplx-icon-telescope')
    expect(s).toContain('[role="listbox"]')
    expect(s).toContain('[role="menuitem"]')
    expect(s).toContain('xlink:href')
  })

  it('uses icon-based matching for computer', () => {
    const s = buildModeSwitchScript('computer')
    expect(s).toContain('#pplx-icon-click')
    expect(s).toContain('[role="menuitem"]')
  })

  it('handles create mode with computer icon', () => {
    const s = buildModeSwitchScript('create')
    expect(s).toContain('#pplx-icon-custom-computer')
  })

  it('handles learn mode with book icon', () => {
    const s = buildModeSwitchScript('learn')
    expect(s).toContain('#pplx-icon-book')
  })

  it('handles review mode with file-check icon', () => {
    const s = buildModeSwitchScript('review')
    expect(s).toContain('#pplx-icon-file-check')
  })

  it('returns no_action for standard mode', () => {
    const s = buildModeSwitchScript('standard')
    expect(s).toContain('standard_mode_no_action')
  })

  it('skips shortcut-typeahead-option items', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toContain('shortcut-typeahead-option')
  })

  it('returns no_listbox_found when listbox missing', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toContain('no_listbox_found')
  })

  it('returns a synchronous IIFE', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).toMatch(/^\(function\(\)\s*\{[\s\S]*\}\)\(\)$/)
  })

  it('does not use setTimeout', () => {
    const s = buildModeSwitchScript('deep-research')
    expect(s).not.toContain('setTimeout')
  })

  it('uses fallback icon for unknown mode', () => {
    const s = buildModeSwitchScript('unknown-custom-mode')
    expect(s).toContain('#pplx-icon-unknown-custom-mode')
  })
})

describe('buildModeSwitchScript injection safety', () => {
  it('escapes special characters in mode icon href', () => {
    // Use an unknown mode with special chars — it gets the #pplx-icon- prefix
    const malicious = "test';alert(1);//"
    const script = buildModeSwitchScript(malicious)
    const expected = JSON.stringify(`#pplx-icon-${malicious}`)
    expect(script).toContain('var iconHref = ' + expected + ';')
    // Verify JSON round-trip is safe
    expect(JSON.parse(expected)).toBe(`#pplx-icon-${malicious}`)
  })
})

describe('buildNewChatScript', () => {
  it('navigates to perplexity.ai', () => {
    const s = buildNewChatScript()
    expect(s).toContain('perplexity.ai')
  })
})

describe('buildReadActiveModeScript', () => {
  it('returns a synchronous IIFE', () => {
    const s = buildReadActiveModeScript()
    expect(s).toMatch(/^\(function\(\)\s*\{[\s\S]*\}\)\(\)$/)
  })

  it('detects computer mode from /copilot/ URL', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain('/copilot/')
    expect(s).toContain("return 'computer'")
  })

  it('detects computer mode from /computer/tasks/ URL', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain('/computer/tasks/')
  })

  it('looks for bg-subtle class on menuitems', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain('.bg-subtle')
  })

  it('maps telescope icon to deep-research', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("#pplx-icon-telescope")
    expect(s).toContain('"deep-research"')
  })

  it('maps gavel icon to model-council', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("#pplx-icon-gavel")
    expect(s).toContain('"model-council"')
  })

  it('maps book icon to learn', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("#pplx-icon-book")
    expect(s).toContain('"learn"')
  })

  it('maps file-check icon to review', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("#pplx-icon-file-check")
    expect(s).toContain('"review"')
  })

  it('maps click icon to computer', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("#pplx-icon-click")
  })

  it('skips shortcut-typeahead-option items', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain('shortcut-typeahead-option')
  })

  it('returns standard as default fallback', () => {
    const s = buildReadActiveModeScript()
    expect(s).toContain("return 'standard'")
  })

  it('does not use setTimeout', () => {
    const s = buildReadActiveModeScript()
    expect(s).not.toContain('setTimeout')
  })
})
