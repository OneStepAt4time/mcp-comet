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
  MODE: {
    search: ['button[aria-label="Search"][data-state="checked"]', 'button[aria-label="Search"]'],
    research: [
      'button[aria-label="Research"][data-state="checked"]',
      'button[aria-label="Research"]',
    ],
    labs: ['button[aria-label="Labs"][data-state="checked"]', 'button[aria-label="Labs"]'],
    learn: ['button[aria-label="Learn"][data-state="checked"]', 'button[aria-label="Learn"]'],
  },
}
