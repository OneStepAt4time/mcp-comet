import { describe, expect, it } from 'vitest'
import { SELECTORS } from '../../../src/ui/selectors.js'

describe('SELECTORS', () => {
  it('INPUT has contenteditable first and >= 3 selectors', () => {
    expect(SELECTORS.INPUT[0]).toBe('[contenteditable="true"]')
    expect(SELECTORS.INPUT.length).toBeGreaterThanOrEqual(3)
  })
  it('SUBMIT has >= 2 selectors', () => {
    expect(SELECTORS.SUBMIT.length).toBeGreaterThanOrEqual(2)
  })
  it('STOP has >= 2 selectors', () => {
    expect(SELECTORS.STOP.length).toBeGreaterThanOrEqual(2)
  })
  it('RESPONSE has >= 1 selector with prose', () => {
    expect(SELECTORS.RESPONSE.length).toBeGreaterThanOrEqual(1)
    expect(SELECTORS.RESPONSE[0]).toContain('prose')
  })
  it('TYPEAHEAD_MENU targets the slash command menu', () => {
    expect(SELECTORS.TYPEAHEAD_MENU[0]).toBe('[role="listbox"][aria-label="Typeahead menu"]')
    expect(SELECTORS.TYPEAHEAD_MENU.length).toBeGreaterThanOrEqual(1)
  })
  it('MENU_ITEM targets menu items in the typeahead', () => {
    expect(SELECTORS.MENU_ITEM[0]).toBe('[role="menuitem"].group\\/item')
    expect(SELECTORS.MENU_ITEM.length).toBeGreaterThanOrEqual(1)
  })
  it('ACTION_BANNER targets the permission prompt container', () => {
    expect(SELECTORS.ACTION_BANNER.length).toBeGreaterThanOrEqual(1)
    expect(SELECTORS.ACTION_BANNER[0]).toContain('banner')
  })
})
