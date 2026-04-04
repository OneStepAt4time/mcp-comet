import { describe, expect, it } from 'vitest'
import {
  buildExtractPageContentScript,
  buildExtractSourcesScript,
} from '../../../src/ui/extraction.js'

describe('buildExtractSourcesScript', () => {
  it('targets tabpanel elements for source extraction', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('[role="tabpanel"]')
    expect(s).toContain('querySelectorAll')
  })

  it('filters out internal perplexity.ai links', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('isInternalLink')
    expect(s).toContain('perplexity.ai')
  })

  it('deduplicates sources by URL', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('seenUrls')
  })

  it('extracts url and title fields', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('url:')
    expect(s).toContain('title:')
  })

  it('excludes javascript and hash-only links', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('javascript:')
    expect(s).toContain('#')
  })
})

describe('buildExtractPageContentScript', () => {
  it('extracts body text', () => {
    const s = buildExtractPageContentScript()
    expect(s).toContain('innerText')
    expect(s).toContain('body')
  })
  it('respects maxLength', () => {
    const s = buildExtractPageContentScript(5000)
    expect(s).toContain('5000')
  })
})
