import { describe, expect, it } from 'vitest'
import { buildTypePromptScript } from '../../../src/ui/input.js'

describe('buildTypePromptScript', () => {
  it('escapes quotes', () => {
    const s = buildTypePromptScript('he said "hello"')
    expect(s).not.toContain('he said "hello"')
  })
  it('escapes newlines', () => {
    const s = buildTypePromptScript('line1\nline2')
    expect(s).toContain('line1\\nline2')
  })
  it('uses execCommand for contenteditable', () => {
    const s = buildTypePromptScript('test')
    expect(s).toContain('execCommand')
    expect(s).toContain('insertText')
  })
})

describe('buildTypePromptScript injection safety', () => {
  it('safely embeds backticks via JSON.stringify', () => {
    const prompt = 'test` injected code'
    const literal = JSON.stringify(prompt)
    const script = buildTypePromptScript(prompt)
    // The prompt must appear as a JSON string literal in the script
    expect(script).toContain(literal)
    // The literal must be parseable as JSON (proving safe embedding)
    expect(() => JSON.parse(literal)).not.toThrow()
  })

  it('safely embeds template literal expressions via JSON.stringify', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: test verifies injection safety of ${...} in strings
    const prompt = '${document.cookie}'
    const literal = JSON.stringify(prompt)
    const script = buildTypePromptScript(prompt)
    expect(script).toContain(literal)
    expect(() => JSON.parse(literal)).not.toThrow()
  })

  it('escapes unicode line separators', () => {
    const script = buildTypePromptScript('test\u2028line')
    // JSON.stringify escapes U+2028 as \u2028
    expect(script).not.toContain('\u2028')
    expect(script).toContain('\\u2028')
  })
})
