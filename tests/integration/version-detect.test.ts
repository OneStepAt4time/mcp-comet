import { describe, expect, it } from 'vitest'

describe('parseChromeVersion', () => {
  it('parses Chrome/145.1.7632.3200', async () => {
    const { parseChromeVersion } = await import('../../src/selectors/index.js')
    expect(parseChromeVersion('Chrome/145.1.7632.3200')).toBe(145)
  })
  it('parses Chrome/146.0.0.0', async () => {
    const { parseChromeVersion } = await import('../../src/selectors/index.js')
    expect(parseChromeVersion('Chrome/146.0.0.0')).toBe(146)
  })
  it('returns 0 for unknown', async () => {
    const { parseChromeVersion } = await import('../../src/selectors/index.js')
    expect(parseChromeVersion('Unknown')).toBe(0)
  })
})

describe('getSelectorsForVersion', () => {
  it('returns v145 selectors for version 145', async () => {
    const { getSelectorsForVersion } = await import('../../src/selectors/index.js')
    const s = getSelectorsForVersion(145)
    expect(s.INPUT).toContain('[contenteditable="true"]')
  })
  it('falls back to v145 for unknown version', async () => {
    const { getSelectorsForVersion } = await import('../../src/selectors/index.js')
    const s = getSelectorsForVersion(999)
    expect(s.INPUT).toContain('[contenteditable="true"]')
  })
})
