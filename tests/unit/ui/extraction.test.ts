import { describe, expect, it } from 'vitest'
import {
  buildExpandCollapsedCitationsScript,
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

  // Edge case tests
  it('filters javascript: URLs', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain("href.indexOf('javascript:')")
  })

  it('filters hash-only URLs', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain("href.indexOf('#') === href.length - 1")
  })

  it('deduplicates by seenUrls map', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('seenUrls[href]')
    expect(s).toContain('seenUrls = {}')
  })

  it('uses domain fallback title when text is empty', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('extractDomain')
    expect(s).toContain('text || extractDomain')
  })
})

describe('citation extraction strategy', () => {
  it('includes citation element strategy', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('citation')
  })

  it('looks for citation class elements', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('[class*="citation"]')
  })

  it('extracts URL from closest anchor parent of citation', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('closest')
    expect(s).toContain('a')
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

  // Edge case tests
  it('accepts custom maxLength parameter', () => {
    const s = buildExtractPageContentScript(3000)
    expect(s).toContain('3000')
  })

  it('handles null body', () => {
    const s = buildExtractPageContentScript()
    expect(s).toContain('if (!body)')
    expect(s).toContain("return JSON.stringify({ text: '', title: '' })")
  })

  it('strips UI noise like Sign in and Log in', () => {
    const s = buildExtractPageContentScript()
    expect(s).toContain('Sign in')
    expect(s).toContain('Log in')
  })
})

describe('buildExpandCollapsedCitationsScript', () => {
  it('returns a synchronous IIFE', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toMatch(/^\(function\(\)\s*\{[\s\S]*\}\)\(\)$/)
  })

  it('targets citation elements', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toContain('[class*="citation"]')
  })

  it('skips citation-nbsp elements', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toContain('citation-nbsp')
  })

  it('skips citations that already have an anchor link', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toContain('closest')
    expect(s).toContain('querySelector')
  })

  it('clicks citations with + pattern', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toContain("indexOf('+')")
    expect(s).toContain('.click()')
  })

  it('returns the count of clicked citations', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).toContain('clicked')
  })

  it('does not use setTimeout', () => {
    const s = buildExpandCollapsedCitationsScript()
    expect(s).not.toContain('setTimeout')
  })
})
