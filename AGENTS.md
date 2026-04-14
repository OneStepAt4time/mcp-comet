# AGENTS.md — MCP Comet

MCP Comet is a TypeScript MCP (Model Context Protocol) server that automates the Perplexity Comet browser via Chrome DevTools Protocol (CDP). It exposes 14 tools over stdio for prompting, polling, screenshots, tab management, source extraction, and mode switching.

## Commands

```bash
npm run build          # tsc → dist/
npm test               # vitest run
npm run test:watch     # vitest in watch mode
npm run test:ci        # vitest run --coverage (CI uses this)
npm run lint           # biome check .
npm run format         # biome write . (auto-fix)
npm run typecheck      # tsc --noEmit
npm start              # node dist/index.js (stdio MCP server)
```

CI pipeline (`.github/workflows/ci.yml`): `npm ci → build → lint → vitest run --coverage` on Node 22.

**Before committing**: run `npm run lint && npm test`.

## Architecture

Four layers, top to bottom:

```
MCP Tools (server.ts) → UI Automation (src/ui/) → CDP Transport (src/cdp/) → Comet Browser
```

- **server.ts** — Single file defining all 14 tools via `McpServer.tool()`. Contains `startServer()`, tool definitions, Zod schemas, and all handler logic. This is the main file to edit when adding/modifying tools.
- **src/ui/** — Functions that return JavaScript strings (evaluated in the browser via `Runtime.evaluate`). Each `build*Script()` function returns a self-contained IIFE string. **Do not** pass complex objects — everything must serialize to a JS expression.
- **src/cdp/client.ts** — `CDPClient` singleton (`CDPClient.getInstance()`) managing WebSocket connections, auto-reconnect with exponential backoff, and an operation queue (`enqueue()`) to serialize concurrent CDP calls.
- **src/selectors/** — Version-keyed CSS selector sets (`SelectorSet`). `v145.ts` is the current set. New Comet/Chrome versions get a new `v{version}.ts` file registered in `index.ts`. Unknown versions fall back to the latest known set.

### Key flow: `comet_ask` (fire-and-forget) + `comet_wait` (blocking poll)

`comet_ask` types the prompt via `execCommand('insertText')` and submits immediately — it does NOT wait for a response. `comet_wait` (or `comet_poll`) must be called separately to retrieve results. This is a deliberate design: decoupled prompt submission from response polling.

### Auto-connect

Every tool handler calls `ensureConnected()` first, which lazily launches/connects to Comet if no session exists. Connection health is verified by evaluating `1+1` via CDP with a timeout.

## Code Style

- **Formatter**: Biome (2-space indent, single quotes, no semicolons, trailing commas, 100 char line width)
- **Module system**: ESM only (`"type": "module"`, `Node16` module resolution, `.js` extensions in imports)
- **Imports**: Always use `.js` extension in import paths (TypeScript ESM requirement)
- **Strict mode**: TypeScript strict enabled
- **Lint rules**: `noExplicitAny: error` in source (off in tests), `noConsole: warn` in source (off in tests, suppress with `// biome-ignore lint/suspicious/noConsole: ...`)
- **Zod for schemas**: Tool parameters defined as Zod raw shapes; `buildInputSchema()` converts to JSON schema for the exported registry

## Testing

Vitest with v8 coverage. Coverage thresholds: 75% statements/lines, 70% branches, 80% functions.

### Test structure

- **`tests/unit/`** — Mocked CDP, isolated component tests. UI script tests validate that `build*Script()` functions produce valid JS containing expected patterns.
- **`tests/integration/tools/`** — End-to-end tool handler tests using the **harness pattern** (`tests/integration/tools/harness.ts`).

### Integration test harness

The harness (`harness.ts`) is critical to understand:

1. Mocks `McpServer` to capture handler functions during `startServer()` into `capturedHandlers`
2. Mocks `CDPClient.getInstance()` to return a controllable `mocks` object
3. Mocks `loadConfig` and `detectCometVersion`
4. Tests call `registerHandlers()` in `beforeAll`, then `getHandler('tool_name')` to get the handler

When writing new tool tests:
```ts
import { getHandler, mocks, registerHandlers, resetHarness } from './harness.js'

beforeAll(async () => { await registerHandlers() })
beforeEach(() => { resetHarness() })
// Override mocks as needed per test, then call the handler
```

### Unit test patterns

- **CDPClient tests**: Mock `chrome-remote-interface` and `globalThis.fetch` for HTTP endpoints (`/json/version`, `/json/list`)
- **UI script tests**: Call `build*Script()` functions and assert on the returned string content (no browser needed)
- Reset singleton between tests: `CDPClient.resetInstance()`

## Gotchas and Non-Obvious Patterns

- **UI scripts are strings, not functions**: Everything in `src/ui/` returns a JS string that gets evaluated remotely via `Runtime.evaluate`. You cannot pass closures or use Node APIs inside these scripts. All context must be embedded in the string via string interpolation.

- **Prompt injection uses `execCommand('insertText')`**: Comet uses a Lexical editor that ignores standard `value` assignment. Prompts are JSON.stringify'd before injection to prevent XSS/injection attacks.

- **Singleton CDPClient**: `CDPClient.getInstance()` returns one instance. Tests must call `CDPClient.resetInstance()` to clear state between test runs.

- **Operation queue**: `CDPClient.enqueue()` serializes all operations. Nested calls within an `enqueue` block are fine, but two concurrent external calls will be sequenced.

- **Auto-reconnect**: `withAutoReconnect()` wraps operations with retry logic. Health checks evaluate `1+1` and reconnect on failure. The reconnect itself is deduplicated via `reconnectPromise`.

- **Tab categorization**: Tabs are classified by URL patterns. `perplexity.ai` with `sidecar` in URL → Sidecar. `chrome://` tabs must never be closed (crashes Comet). Only `agentBrowsing` tabs are closed during cleanup.

- **`comet_mode` requires navigation to home**: Mode switching only works on a new chat page. The tool navigates to `https://www.perplexity.ai` before attempting the slash-command typeahead.

- **Collapsed citations**: Sources with empty URLs and text containing `+` (e.g., "wsj+3") are detected as collapsed. `comet_get_sources` does a two-pass extraction: first pass collects what's visible, second pass clicks collapsed items (via `buildExpandCollapsedCitationsScript`) and re-extracts, then merges by deduplicating on URL.

- **No `src/server.test.ts`**: Server logic is tested via the integration test harness in `tests/integration/tools/`, not via a unit test file.

- **`index.ts` is the stdio entry point**: It imports and calls `startServer()` from `server.ts`. The `cli.ts` file is the `mcp-comet` binary with subcommands (`start`, `call`, `detect`).

- **Logger writes to stderr**: All logging goes to stderr to avoid corrupting MCP stdio JSON-RPC messages on stdout.

- **Release**: Triggered by pushing `v*` tags. Publishes to npm as `@onestepat4time/mcp-comet`. Uses `release-please` for changelog/version management.

## Adding a New Comet Version

When Comet updates its Chrome version and CSS selectors change:

1. Run `mcp-comet detect` to get the Chrome major version
2. Inspect Comet DOM with DevTools
3. Create `src/selectors/v{version}.ts` implementing `SelectorSet` interface
4. Register in `src/selectors/index.ts` selector map
5. Add unit tests in `tests/unit/selectors/`
6. Update `docs/comet-compatibility.md`

## Commit Conventions

Conventional commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. CI requires passing lint + tests before merge.
