import { describe, expect, it } from 'vitest'

describe('parseChromeVersion', () => {
  it('extracts major version from Chrome string', async () => {
    const { parseChromeVersion } = await import('../../../src/selectors/index.js')
    expect(parseChromeVersion('Chrome/145.0.5678.90')).toBe(145)
  })

  it('returns 0 for non-Chrome string', async () => {
    const { parseChromeVersion } = await import('../../../src/selectors/index.js')
    expect(parseChromeVersion('Firefox/120.0')).toBe(0)
  })

  it('returns 0 for empty string', async () => {
    const { parseChromeVersion } = await import('../../../src/selectors/index.js')
    expect(parseChromeVersion('')).toBe(0)
  })
})

describe('getSelectorsForVersion', () => {
  it('returns v145 selectors for version 145', async () => {
    const { getSelectorsForVersion } = await import('../../../src/selectors/index.js')
    const selectors = getSelectorsForVersion(145)
    expect(selectors.INPUT).toBeDefined()
    expect(selectors.SUBMIT).toBeDefined()
    expect(selectors.STOP).toBeDefined()
    expect(selectors.RESPONSE).toBeDefined()
    expect(selectors.LOADING).toBeDefined()
    expect(selectors.TYPEAHEAD_MENU).toBeDefined()
    expect(selectors.MENU_ITEM).toBeDefined()
  })

  it('returns fallback (v145) selectors for unknown version 999', async () => {
    const { getSelectorsForVersion } = await import('../../../src/selectors/index.js')
    const selectors = getSelectorsForVersion(999)
    expect(selectors.INPUT).toBeDefined()
    expect(selectors.SUBMIT).toBeDefined()
    // Should be same as v145
    expect(selectors.INPUT.length).toBeGreaterThan(0)
  })
})
