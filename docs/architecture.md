# Architecture

Asteria uses a four-layer architecture:

```
MCP Tools (13 tools)
    |
UI Automation (selectors, input, status, extraction, navigation)
    |
CDP Transport (browser launch, connection, tabs, client)
    |
Perplexity Comet Browser (Chromium)
```

## MCP Layer

Asteria exposes 13 MCP tools grouped by function:

**Session**

| Tool | Purpose |
|------|---------|
| `comet_connect` | Launch or connect to Comet browser |
| `comet_poll` | Poll current agent status |
| `comet_wait` | Wait for an in-progress agent to finish |
| `comet_stop` | Stop a running agent |

**Query**

| Tool | Purpose |
|------|---------|
| `comet_ask` | Send a prompt and wait for the response |
| `comet_mode` | Switch Comet focus mode |

**Content**

| Tool | Purpose |
|------|---------|
| `comet_screenshot` | Capture a screenshot of the current page |
| `comet_get_sources` | Extract cited sources from the response |
| `comet_get_page_content` | Extract full page content as text |

**Navigation**

| Tool | Purpose |
|------|---------|
| `comet_list_tabs` | List open browser tabs |
| `comet_switch_tab` | Switch to a specific tab |
| `comet_list_conversations` | List conversations in the sidebar |
| `comet_open_conversation` | Open a specific conversation |

## UI Automation Layer

### Selector Strategy Pattern

Selectors are ordered arrays of CSS selectors. Each strategy tries selectors in order until one matches. This makes the system resilient to UI changes: add new selectors at the front, old ones become fallbacks.

### Typeahead Mode Detection

When switching modes via `comet_mode`, Asteria reads the SVG icon `href` from typeahead menu items with the `.bg-subtle` class. Icon IDs map to mode names:

| Icon ID | Mode |
|---------|------|
| `#pplx-icon-telescope` | deep-research |
| `#pplx-icon-gavel` | model-council |
| `#pplx-icon-book` | learn |
| `#pplx-icon-file-check` | review |
| `#pplx-icon-click` | computer |
| `#pplx-icon-custom-computer` | computer |

If icon detection fails, the system falls back to URL-based mode detection.

### Collapsed Citation Expansion

Sources with collapsed citation text (matching the pattern `^\w+\+\d+$`, such as "arXiv+3") do not expose a URL directly. Asteria clicks these elements to reveal the full source URL, then re-extracts sources in a second pass. This two-pass strategy ensures complete source collection.

### Prompt Injection

Prompts are injected into the Comet editor using `document.execCommand('insertText')`. This is required because Comet uses a Lexical editor that does not respond to standard `value` property assignments.

The prompt text is embedded via `JSON.stringify()` before injection. This prevents injection attacks by escaping backticks, template literals, and Unicode line separators (U+2028, U+2029) that would otherwise break the JavaScript wrapper.

## CDP Transport Layer

### Version Detection

On connect, Asteria queries the `/json/version` endpoint to retrieve the Chrome major version number. This version determines which selector set to use from the registry. Unknown versions fall back to the latest known selector set.

### Connection Management

A singleton `CDPClient` manages the browser connection. Tabs are categorized by type: `main`, `sidecar`, `agentBrowsing`, `overlay`, and `other`. Platform-specific browser launching supports Windows, macOS, and WSL environments.

### Auto-Reconnect

Connection health is verified by evaluating `1+1` via CDP with a 3-second timeout. If the check fails, the client triggers an automatic reconnect with exponential backoff. Reconnect state (including attempt count) is tracked to enforce a maximum retry limit.

## Error Handling

Asteria defines 9 error subclasses, all extending the base `AsteriaError`. Each carries a string code, a context object, and an optional cause.

| Code | Class |
|------|-------|
| `CDP_CONNECTION_FAILED` | `CDPConnectionError` |
| `COMET_NOT_FOUND` | `CometNotFoundError` |
| `COMET_LAUNCH_FAILED` | `CometLaunchError` |
| `TAB_NOT_FOUND` | `TabNotFoundError` |
| `TIMEOUT` | `TimeoutError` |
| `EVALUATION_FAILED` | `EvaluationError` |
| `SELECTOR_NOT_FOUND` | `SelectorError` |
| `AGENT_ERROR` | `AgentError` |
| `CONFIG_ERROR` | `ConfigurationError` |

Errors are formatted as `[CODE] message` when converted to MCP responses via `toMcpError()`.

## Data Flow

### comet_ask lifecycle

```
1. ensureConnected()        -- auto-connect if no active session
2. Pre-send state capture   -- snapshot proseCount and lastProseText
3. Type prompt              -- execCommand('insertText') via JSON.stringify
4. Submit                   -- Enter key via CDP
5. Polling loop             -- check status every ASTERIA_POLL_INTERVAL ms
   - Detect new response via proseCount growth
   - Stall detection: 10 polls without growth -> break
6. Response settle          -- 5 x 1s polls to ensure complete text
7. Return                   -- response text + collected steps
```

### comet_wait lifecycle

`comet_wait` is `comet_ask`'s polling loop without the prompt submission steps (3-4). It polls until the agent finishes or stalls, using the same settle logic (5 x 1s polls) to ensure the response is complete before returning.
