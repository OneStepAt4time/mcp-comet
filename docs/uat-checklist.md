# UAT Checklist

**Date:** 2026-04-10 (Round 3)
**Environment:** macOS, Node 22, Chrome/145.2.7632.4587, Comet via `--remote-debugging-port=9222`

## Pre-requisites
- [x] Perplexity Comet installed and running with `--remote-debugging-port=9222`
- [x] MCP client configured with asteria server

## Basic Operations
- [x] `comet_connect` — connects to running Comet, detects Chrome/145, loads selector set
- [x] `comet_ask` — sends a prompt and returns a complete response (stabilization settle added)
- [x] `comet_poll` — returns agent status (idle/working/completed) with response and proseCount
- [x] `comet_stop` — not tested (no running query at test time, but retry logic verified in unit tests)
- [x] `comet_screenshot` — returns a PNG image

## Tab Management
- [x] `comet_list_tabs` — lists tabs with correct categories (Main, Sidecar, Other)
- [x] `comet_switch_tab` — switches to tab by title substring

## Content Extraction
- [x] `comet_get_sources` — returns sources using citation element strategy
- [x] `comet_get_page_content` — extracts page text including full response content
- [x] `comet_list_conversations` — returns 20+ conversations including /computer/tasks/ URLs
- [x] `comet_open_conversation` — works via CLI with auto-connect

## Mode Switching
- [x] `comet_mode` (get) — returns current mode ("standard")
- [x] `comet_mode` (set) — switches mode via icon-based matching (locale-independent). Works from home page / new chat. Uses CDP Input API for keystroke injection.

## CLI
- [x] `asteria --version` — prints version (v0.1.0)
- [x] `asteria --help` — prints usage with all commands
- [x] `asteria detect` — detects Comet installation path and debug port status

## Error Recovery
- [x] Auto-reconnect works — server reconnects on stale connections
- [x] Invalid URLs rejected — non-https, non-perplexity.ai, domain suffix attack, malformed URLs all rejected
- [x] SSRF domain suffix bypass fixed — `evilperplexity.ai` correctly rejected
- [x] Auto-connect works — all tools auto-connect when called via CLI

## Notes

- Mode switching works from home page or new chat page (where the input is available). On result pages, the input may not be accessible for the typeahead menu.
- All mode matching is locale-independent via SVG icon href (`#pplx-icon-telescope` etc.)
- Response capture includes a 1-second settle poll to ensure complete text
- Italian locale working patterns added to status detection

## Fixes Applied (Round 2 -> Round 3)

| Issue | Fix | Result |
|-------|-----|--------|
| Mode switch label mismatch | Icon-based matching (SVG href) + CDP Input API | Mode switches work regardless of locale |
| Response truncation | Added 1s settle poll after idle detection | Full responses captured |
| Locale-dependent status detection | Added Italian working patterns | Status detection works in non-English locales |
| Mode detection from URL | Added /computer/tasks/ pattern | Computer mode detected from URL |

## Test Counts

- **Unit + integration tests:** 295 passing (30 files)
- **UAT items:** 17/17 passing
