# Architecture

Asteria uses a three-layer architecture:

```
MCP Tools (12 tools)
    ↓
UI Automation (selectors, input, status, extraction, navigation)
    ↓
CDP Transport (browser launch, connection, tabs, client)
    ↓
Perplexity Comet Browser (Chromium)
```

## Selector Strategy Pattern

Selectors are ordered arrays of CSS selectors. Each strategy tries selectors in order until one matches. This makes the system resilient to UI changes — add new selectors at the front, old ones become fallbacks.

## Version Detection

On connect, Asteria queries `/json/version` to get the Chrome major version, then routes to the appropriate selector set from the registry. Unknown versions fall back to the latest known set.

## Error Handling

- 9 error subclasses with error codes
- Auto-reconnect with exponential backoff
- Health checks via `1+1` evaluation with 3s timeout
- MCP error conversion via `toMcpError()`

## Connection Management

- Singleton CDPClient with auto-reconnect
- Tab categorization: main, sidecar, agentBrowsing, overlay, other
- Platform-specific browser launching (Windows, macOS, WSL)
