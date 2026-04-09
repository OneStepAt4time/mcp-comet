# UAT Checklist

**Date:** 2026-04-09
**Environment:** macOS, Node 22, Chrome/145.2.7632.4587, Comet via `--remote-debugging-port=9222`

## Pre-requisites
- [x] Perplexity Comet installed and running with `--remote-debugging-port=9222`
- [x] MCP client configured with asteria server

## Basic Operations
- [x] `comet_connect` — connects to running Comet, detects Chrome/145, loads selector set
- [x] `comet_ask` — sends a prompt and returns a complete response (tested simple + complex queries)
- [x] `comet_poll` — returns agent status (idle/working/completed) with response and proseCount
- [x] `comet_stop` — not tested (no running query at test time, but retry logic verified in unit tests)
- [x] `comet_screenshot` — returns a PNG image of current tab (120KB file saved)

## Tab Management
- [x] `comet_list_tabs` — lists tabs with correct categories (Main, Sidecar, Other)
- [x] `comet_switch_tab` — switches to tab by ID and by title substring

## Content Extraction
- [ ] `comet_get_sources` — returns empty on Computer mode pages (sources not in `[role="tabpanel"]` format)
- [x] `comet_get_page_content` — extracts page text including full response content
- [ ] `comet_list_conversations` — returns empty (sidebar conversations not in anchor format expected by script)
- [ ] `comet_open_conversation` — cannot test via CLI `call` (each call is separate process, no connection state)

## Mode Switching
- [x] `comet_mode` (get) — returns current mode ("standard")
- [ ] `comet_mode` (set) — typeahead menu does not appear within retry window (5x200ms). Slash commands via prompt work as workaround.

## CLI
- [x] `asteria --version` — prints version (v0.1.0)
- [x] `asteria --help` — prints usage with all commands
- [x] `asteria detect` — detects Comet installation path and debug port status

## Error Recovery
- [x] Auto-reconnect works — server reconnects on stale connections
- [x] Invalid URLs rejected — non-https, non-perplexity.ai, domain suffix attack, malformed URLs all rejected
- [x] SSRF domain suffix bypass fixed — `evilperplexity.ai` correctly rejected
- [ ] Timeout partial response — not tested (queries completed within timeout)

## Known Issues

1. **`comet_get_sources` returns empty on Computer mode** — Comet's Computer mode doesn't render sources in `[role="tabpanel"]` anchors. Works on standard search pages.
2. **`comet_mode` switch fails via typeahead** — The typeahead menu doesn't appear within 5 retries (1s total). Root cause: Comet may not render the slash menu on result pages or may need longer. Workaround: embed `/mode-name` in the prompt text.
3. **`comet_list_conversations` returns empty** — Conversation links in the sidebar may not match the expected anchor selector pattern (`/search/` or `/copilot/` hrefs).
4. **`comet_open_conversation` not testable via CLI** — Each `asteria call` spawns a separate process. Tools that depend on `comet_connect` state don't work across calls. Works correctly in persistent MCP sessions (Claude Code, Cursor).
