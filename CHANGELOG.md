# Changelog

## [1.1.1] - 2026-04-11

### Fixed

- **Screenshot Format (Issue #1, PR #6):** Correctly handles MCP error responses during screenshots to prevent false-positive failures on transient connection drops. `comet_screenshot` explicitly documents `jpeg` support.
- **Protocol Violation in `comet_ask` (Issue #2, PR #7):** Decoupled the polling loop from `comet_ask` to prevent MCP transport timeouts (60s) during deep research tasks. The tool now submits the prompt and returns immediately; clients should use `comet_poll` or `comet_wait` to retrieve the final result.
- **Aggressive Health Check (Issue #3, PR #8):** Increased the `isHealthy` CDP evaluate tolerance from 3s to 10s to prevent aggressive reconnections when Comet is busy rendering heavy React hydration tasks.
- **Brittle State Detection Heuristics (Issue #4, PR #9):** Removed fragile English text heuristics (e.g., 'Ask a follow-up') from the agent status detection script (`status.ts`). It now reliably determines completion based on the structural presence of parsed prose chunks (`results.length > 0`).

## [1.1.0] - 2026-04-10

### Added

- `comet_wait` tool: polls until agent finishes, returns full response (useful after `comet_ask` timeout)
- Typeahead-based active mode detection via `buildReadActiveModeScript()` — reads mode from SVG icons in typeahead menu
- Collapsed citation expansion: `buildExpandCollapsedCitationsScript()` clicks collapsed citations to reveal full source URLs
- Second-pass source extraction: automatically expands collapsed citations and merges revealed URLs

### Changed

- `comet_mode` (get) now uses typeahead menu inspection instead of URL-only detection
- `comet_get_sources` automatically expands collapsed citations (`wsj+3` pattern) for full URLs
- 13 tools total (was 12)

## [1.0.0] - 2026-04-10

First stable release. MCP server for Perplexity Comet browser automation via Chrome DevTools Protocol.

### Tools (12)

| Tool | Description |
|------|-------------|
| `comet_connect` | Connect to or launch Comet browser |
| `comet_ask` | Send prompt and poll until response |
| `comet_poll` | Get agent status, steps, and response |
| `comet_stop` | Stop a running agent |
| `comet_screenshot` | Capture current tab as PNG/JPEG |
| `comet_mode` | Get or switch Comet mode (icon-based, locale-independent) |
| `comet_list_tabs` | List tabs by category (main, sidecar, agent-browsing, other) |
| `comet_switch_tab` | Switch tab by ID or title |
| `comet_get_sources` | Extract sources/citations (tabpanel + citation element strategies) |
| `comet_list_conversations` | List conversations (search, copilot, computer/tasks patterns) |
| `comet_open_conversation` | Navigate to a conversation URL |
| `comet_get_page_content` | Extract page text and title |

### Features

- **Auto-connect**: All tools auto-connect when called via CLI
- **Locale-independent mode switching**: SVG icon matching works regardless of UI language
- **CDP Input API**: Proper keyboard injection for Lexical editor
- **Multi-strategy source extraction**: Tabpanel anchors + citation elements + collapsed citations
- **Conversation listing**: Supports `/search/`, `/copilot/`, `/computer/tasks/` with title dedup
- **SSRF protection**: Domain validation prevents redirect and suffix attacks
- **Auto-reconnect**: Health checks with exponential backoff
- **Comet version detection**: Auto-detects Chrome version, loads matching selectors
- **Config validation**: Clamping and enum validation for all values

### Tech Stack

TypeScript, Vitest, Chrome DevTools Protocol, Biome. 295 tests, 30 files.

## [0.1.0] - 2026-04-04

### Added
- 12 MCP tools for Perplexity Comet browser control
- CDP transport with auto-reconnect and health checks
- UI automation with selector strategy pattern
- Agent status detection with working patterns
- Multi-strategy prompt submission
- Tab management with categorization
- CLI with --help, --version, detect, snapshot commands
- Comet version auto-detection and selector registry
