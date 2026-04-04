import type { SelectorSet } from './types.js'

export const v145Selectors: SelectorSet = {
  INPUT: [
    '[contenteditable="true"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    'textarea',
    'input[type="text"]',
  ],
  SUBMIT: [
    'button[aria-label*="Submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Ask"]',
    'button[type="submit"]',
  ],
  STOP: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'],
  RESPONSE: ['[class*="prose"]', 'main'],
  LOADING: ['[class*="animate-spin"]', '[class*="animate-pulse"]'],
  TYPEAHEAD_MENU: ['[role="listbox"][aria-label="Typeahead menu"]', '[role="listbox"]'],
  MENU_ITEM: ['[role="menuitem"].group\\/item', '[role="menuitem"]'],
}
