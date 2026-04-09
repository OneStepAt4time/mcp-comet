# Changelog

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
