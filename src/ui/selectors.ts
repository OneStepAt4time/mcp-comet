export const SELECTORS = {
  INPUT: [
    '[contenteditable="true"]',
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="Search"]',
    'textarea',
    'input[type="text"]',
  ] as const,
  SUBMIT: [
    'button[aria-label*="Submit"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="Ask"]',
    'button[type="submit"]',
  ] as const,
  STOP: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'] as const,
  RESPONSE: ['[class*="prose"]', 'main'] as const,
  // Modes are now accessed via "/" slash command → typeahead menu
  // These selectors target the typeahead menu structure
  TYPEAHEAD_MENU: ['[role="listbox"][aria-label="Typeahead menu"]', '[role="listbox"]'] as const,
  MENU_ITEM: ['[role="menuitem"].group\\/item', '[role="menuitem"]'] as const,
  LOADING: ['[class*="animate-spin"]', '[class*="animate-pulse"]'] as const,
} as const
