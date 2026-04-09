import { describe, expect, it } from 'vitest'
import { isPerplexityDomain } from '../../src/utils.js'

describe('isPerplexityDomain', () => {
  it('accepts exact perplexity.ai', () => {
    expect(isPerplexityDomain('perplexity.ai')).toBe(true)
  })

  it('accepts www.perplexity.ai', () => {
    expect(isPerplexityDomain('www.perplexity.ai')).toBe(true)
  })

  it('accepts subdomain.perplexity.ai', () => {
    expect(isPerplexityDomain('sub.perplexity.ai')).toBe(true)
  })

  it('rejects evilperplexity.ai', () => {
    expect(isPerplexityDomain('evilperplexity.ai')).toBe(false)
  })

  it('rejects unrelated domain', () => {
    expect(isPerplexityDomain('example.com')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isPerplexityDomain('')).toBe(false)
  })
})
