import { describe, expect, it } from 'vitest'
import {
  buildExtractPageContentScript,
  buildExtractSourcesScript,
} from '../../../src/ui/extraction.js'

describe('buildExtractSourcesScript', () => {
  it('finds anchors and deduplicates', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('querySelectorAll')
    expect(s).toContain('href')
    expect(s).toContain('seenUrls')
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
