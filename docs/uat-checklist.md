# UAT Checklist

## Pre-requisites
- [ ] Perplexity Comet installed and running with `--remote-debugging-port=9222`
- [ ] MCP client configured with asteria server

## Basic Operations
- [ ] `comet_connect` — connects to running Comet or launches new instance
- [ ] `comet_ask` — sends a prompt and returns a complete response
- [ ] `comet_poll` — returns agent status (idle/working/completed)
- [ ] `comet_stop` — stops a running agent query
- [ ] `comet_screenshot` — returns a PNG image of current tab

## Tab Management
- [ ] `comet_list_tabs` — lists tabs with correct categories
- [ ] `comet_switch_tab` — switches to tab by ID or title

## Content Extraction
- [ ] `comet_get_sources` — returns source URLs after a search
- [ ] `comet_get_page_content` — extracts page text
- [ ] `comet_list_conversations` — lists recent conversations
- [ ] `comet_open_conversation` — navigates to conversation URL

## Mode Switching
- [ ] `comet_mode` — switches between search/research/labs/learn

## CLI
- [ ] `asteria --version` — prints version
- [ ] `asteria --help` — prints usage
- [ ] `asteria detect` — detects Comet installation

## Error Recovery
- [ ] Agent reconnects after Comet restart
- [ ] Timeout returns partial response with steps
- [ ] Invalid URLs in open_conversation are rejected
