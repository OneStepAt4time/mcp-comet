# Comet Compatibility

Asteria interacts with Comet through the Chrome DevTools Protocol, relying on CSS selectors to locate DOM elements such as the prompt input, submit button, and response container. When Comet updates its internal Chrome version, the DOM structure may change, breaking those selectors. Asteria handles this through a versioned selector system.

## Supported Versions

| Chrome Version | Selector Set | Status |
|---------------|-------------|--------|
| 145 | v145 | Supported |

Unknown or newer versions fall back to the latest known selector set (currently v145).

## How Version Detection Works

When a client calls `comet_connect`, Asteria performs automatic version detection:

1. Queries the CDP endpoint at `http://127.0.0.1:{port}/json/version`
2. Extracts the Chrome major version from the `Browser` field in the response (for example, `145` from `Chrome/145.2.7632.4587`)
3. Looks up the matching selector set in the version registry (`src/selectors/index.ts`)
4. Falls back to the latest known set if the detected version is not in the registry
5. Stores the active selector set for use by all subsequent tool calls

The detection is implemented in `src/version.ts` (`detectCometVersion`). On failure (network error, non-OK response, or unrecognized browser string), the function logs a warning and returns the default selector set so that tool calls can still proceed.

## Selector Strategy Pattern

Each selector set is a collection of ordered arrays of CSS selectors. For every DOM operation, Asteria tries selectors in array order and uses the first one that matches an element.

### Why ordered arrays matter

- Comet updates may change the DOM structure between versions.
- New, version-specific selectors are added at the front of the array.
- Older selectors remain as fallbacks further down the array.
- This makes the system resilient to UI changes without breaking existing functionality.

### Example

The following is a simplified illustration of how ordered selector arrays work. The real selectors are defined in `src/selectors/v145.ts`.

```javascript
// Each selector array tries in order until one matches
const strategies = {
  promptInput: ['#ask-input', '[contenteditable="true"]', 'textarea'],
  submitButton: ['button[type="submit"]', 'form button'],
}
// Try '#ask-input' first. If not found, try '[contenteditable="true"]'. Etc.
```

### Selector categories

Each `SelectorSet` implements the interface defined in `src/selectors/types.ts`:

| Field | Purpose |
|-------|---------|
| `INPUT` | Locates the prompt input field (contenteditable, textarea, or text input) |
| `SUBMIT` | Locates the submit/send button |
| `STOP` | Locates the stop/cancel button during response generation |
| `RESPONSE` | Locates the response output container |
| `LOADING` | Detects loading/spinner indicators |
| `TYPEAHEAD_MENU` | Locates the typeahead suggestion listbox |
| `MENU_ITEM` | Locates individual items within a menu |

## Adding a New Comet Version

When a new Comet release changes the DOM, follow these steps to add support.

### 1. Detect the version

Run Asteria's CLI to see the current Chrome/Comet version:

```bash
asteria detect
```

This queries the CDP endpoint and prints the detected version.

### 2. Inspect the DOM

Open Comet with browser DevTools and inspect the key elements:

- Prompt input field
- Submit button
- Stop/cancel button
- Response container
- Loading indicators
- Typeahead menu and menu items

Note the CSS selectors that uniquely identify each element.

### 3. Create the selector file

Create `src/selectors/v{version}.ts` implementing the `SelectorSet` interface. For example, for Chrome 147:

```typescript
import type { SelectorSet } from './types.js'

export const v147Selectors: SelectorSet = {
  INPUT: [
    // New selectors first
    '[data-testid="prompt-input"]',
    // Then carry over proven selectors as fallbacks
    '[contenteditable="true"]',
    'textarea[placeholder*="Ask"]',
    'textarea',
    'input[type="text"]',
  ],
  SUBMIT: [ /* ... */ ],
  STOP: [ /* ... */ ],
  RESPONSE: [ /* ... */ ],
  LOADING: [ /* ... */ ],
  TYPEAHEAD_MENU: [ /* ... */ ],
  MENU_ITEM: [ /* ... */ ],
}
```

A good starting point is to copy `src/selectors/v145.ts` and update selectors as needed.

### 4. Register the version

Add the new version to the registry map in `src/selectors/index.ts`:

```typescript
import { v147Selectors } from './v147.js'

const selectorMap: Map<number, SelectorSet> = new Map([
  [145, v145Selectors],
  [147, v147Selectors],
])
```

Also update the fallback in `getSelectorsForVersion` if the new version should become the default.

### 5. Test

- Add unit tests for the new selectors in `tests/unit/`.
- Verify against a real Comet instance:

```bash
asteria call comet_connect
```

### 6. Document

Update the **Supported Versions** table at the top of this file with the new version entry.
