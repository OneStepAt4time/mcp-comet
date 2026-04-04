export const SELECTORS = {
  INPUT: ['[contenteditable="true"]', 'textarea[placeholder*="Ask"]', 'textarea[placeholder*="Search"]', 'textarea', 'input[type="text"]'] as const,
  SUBMIT: ['button[aria-label*="Submit"]', 'button[aria-label*="Send"]', 'button[aria-label*="Ask"]', 'button[type="submit"]'] as const,
  STOP: ['button[aria-label*="Stop"]', 'button[aria-label*="Cancel"]'] as const,
  RESPONSE: ['[class*="prose"]', 'main'] as const,
  MODE: {
    search: ['button[aria-label="Search"][data-state="checked"]', 'button[aria-label="Search"]'] as const,
    research: ['button[aria-label="Research"][data-state="checked"]', 'button[aria-label="Research"]'] as const,
    labs: ['button[aria-label="Labs"][data-state="checked"]', 'button[aria-label="Labs"]'] as const,
    learn: ['button[aria-label="Learn"][data-state="checked"]', 'button[aria-label="Learn"]'] as const,
  },
  LOADING: ['[class*="animate-spin"]', '[class*="animate-pulse"]'] as const,
} as const;
