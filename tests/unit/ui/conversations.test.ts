import { describe, expect, it } from 'vitest'
import { buildListConversationsScript } from '../../../src/ui/conversations.js'

describe('buildListConversationsScript', () => {
  it('wraps in IIFE', () => {
    const s = buildListConversationsScript()
    expect(s).toMatch(/\(function\(\)/)
    expect(s).toMatch(/\}\)\(\)/)
  })

  it('queries anchor elements with href', () => {
    const s = buildListConversationsScript()
    expect(s).toContain("document.querySelectorAll('a[href]')")
  })

  it('filters for /search/ URLs', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('/search/')
    expect(s).toContain('indexOf')
  })

  it('filters for /copilot/ URLs', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('/copilot/')
  })

  it('deduplicates via seen map', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('seen')
    expect(s).toContain('seen[href]')
  })

  it('extracts innerText for title', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('innerText')
    expect(s).toContain('trim()')
  })

  it('returns JSON.stringify output', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('JSON.stringify')
    expect(s).toContain('conversations')
  })

  it('builds title and url fields', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('title:')
    expect(s).toContain('url:')
  })

  it('initializes empty conversations array', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('conversations = []')
  })

  it('filters for /computer/tasks/ URLs', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('/computer/tasks/')
  })

  it('deduplicates doubled title text', () => {
    const s = buildListConversationsScript()
    expect(s).toContain('dedupeTitle')
  })
})
