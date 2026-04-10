# Documentation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure Asteria's documentation into enterprise-grade English docs for AI agent developers — README hub + 7 focused doc files.

**Architecture:** README.md is the landing page (install + quickstart + overview). Three new docs (`tools.md`, `integration.md`, `troubleshooting.md`) cover deep reference material. Four existing docs (`architecture.md`, `configuration.md`, `contributing.md`, `comet-compatibility.md`) get updated and expanded.

**Tech Stack:** Markdown, GitHub-flavored. No build tools.

---

### Task 1: Rewrite README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README.md**

Replace the entire README with the following content. Key changes:
- Remove "GIF coming soon" placeholder and demo section
- Update 12 → 13 tools everywhere
- Add `comet_wait` to tools table
- Remove "npm publish" from roadmap (done)
- Remove "active development / install from source" note — just `npm install -g`
- Update architecture diagram to include `comet_wait`
- Add "Guides" section linking to docs
- Tighten prose for enterprise tone
- Keep banner, badges, license, sponsor sections

The new README structure:
1. Banner + badges (keep existing)
2. One-liner pitch
3. How it works mermaid diagram (update T13 label to comet_wait)
4. Installation (just npm install -g)
5. Quick Start (3 steps: MCP config, Comet, use)
6. Tools overview table (13 tools, link to docs/tools.md)
7. CLI reference
8. Configuration link
9. Guides section (links to integration, troubleshooting, architecture)
10. Roadmap (remove npm publish, keep rest)
11. Contributing link
12. Sponsor + license

Write the complete file. Do not use placeholders — every section has real content.

**Step 2: Verify markdown renders correctly**

Run: `cat README.md | head -20`
Expected: Clean markdown, no broken formatting

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for v1.1.0 — 13 tools, professional tone"
```

---

### Task 2: Create docs/tools.md

**Files:**
- Create: `docs/tools.md`

**Step 1: Write docs/tools.md**

Full tool reference for all 13 tools. Each tool entry follows this structure:

```markdown
## comet_ask

Send a prompt to Perplexity Comet and poll until the agent responds or times out.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| prompt | string | Yes | — | The question or instruction to send |
| newChat | boolean | No | false | Start a fresh chat before sending |
| timeout | number | No | 120000 | Maximum wait time in ms |

### Response

Returns the agent's response text. If the agent times out, returns a partial response with steps so far and a suggestion to use `comet_poll` or `comet_wait`.

### Example

asteria call comet_ask '{"prompt": "Summarize the latest AI research papers"}'

### Notes

- Non-blocking: returns partial results if timeout is reached
- Auto-connects if not already connected
- Use `comet_wait` after timeout to get the full response
```

Tool schemas from `src/server.ts:121-149`:

1. **comet_connect** — params: `port` (number, optional). Auto-detects Comet, closes extra tabs, navigates to perplexity.ai.
2. **comet_ask** — params: `prompt` (string, required), `newChat` (boolean, optional), `timeout` (number, optional). Sends prompt, polls until response.
3. **comet_poll** — no params. Returns current agent status JSON.
4. **comet_wait** — params: `timeout` (number, optional, default 120000). Polls until agent finishes, returns full response.
5. **comet_stop** — no params. Clicks stop button. Retries up to 5 times.
6. **comet_screenshot** — params: `format` (enum: png|jpeg, optional, default png). Returns base64 image.
7. **comet_mode** — params: `mode` (enum: standard|deep-research|model-council|create|learn|review|computer, nullable, optional). Omit to get current mode. Icon-based, locale-independent.
8. **comet_list_tabs** — no params. Returns tabs categorized as Main, Sidecar, Agent Browsing, Overlay, Other.
9. **comet_switch_tab** — params: `tabId` (string, optional), `title` (string, optional). Switch by exact ID or title substring.
10. **comet_get_sources** — no params. Extracts citations. Auto-expands collapsed citations (e.g. `wsj+3`).
11. **comet_list_conversations** — no params. Returns recent conversations from sidebar.
12. **comet_open_conversation** — params: `url` (string, required). Must be `https://perplexity.ai/` URL. Validates domain (SSRF protection).
13. **comet_get_page_content** — params: `maxLength` (number, optional, default 10000). Extracts title + body text.

After all 13 tools, add these sections:

**Common Patterns:**
- Ask and wait: `comet_ask` with sufficient timeout
- Ask + poll: `comet_ask` with short timeout, then `comet_poll` in a loop
- Ask + wait: `comet_ask` (may timeout), then `comet_wait` to get full result
- Screenshot verification: `comet_screenshot` after `comet_ask`
- Source extraction: `comet_ask`, then `comet_get_sources`

**Error Responses:**
All errors return `{ content: [{ type: "text", text: "[ERROR_CODE] message" }], isError: true }`

**Connection Lifecycle:**
- All tools call `ensureConnected()` which auto-connects if no active session
- Auto-connect: launches Comet if not running, closes extra tabs, detects Chrome version

**Step 2: Verify file**

Run: `wc -l docs/tools.md`
Expected: ~300-400 lines of well-formatted markdown

**Step 3: Commit**

```bash
git add docs/tools.md
git commit -m "docs: add complete tool reference (13 tools)"
```

---

### Task 3: Create docs/integration.md

**Files:**
- Create: `docs/integration.md`

**Step 1: Write docs/integration.md**

Structure:

1. **Overview** — Asteria communicates via MCP stdio. The MCP client spawns `asteria start` as a subprocess and sends JSON-RPC 2.0 messages over stdin/stdout.

2. **Prerequisites** checklist:
   - Node.js >= 18 installed
   - Perplexity Comet installed (`https://comet.perplexity.ai/`)
   - Comet running with debug port accessible

3. **Claude Code** setup:
   ```json
   // ~/.claude/claude_desktop_config.json
   {
     "mcpServers": {
       "asteria": {
         "type": "stdio",
         "command": "asteria",
         "args": ["start"]
       }
     }
   }
   ```
   Verify: restart Claude Code, ask "What MCP tools are available?"
   Example session: ask Claude to "Search Perplexity for the latest AI news"

4. **Cursor** setup:
   ```json
   // ~/.cursor/mcp.json
   {
     "mcpServers": {
       "asteria": {
         "type": "stdio",
         "command": "asteria",
         "args": ["start"]
       }
     }
   }
   ```
   Verify: open Cursor settings > MCP, check asteria appears

5. **CLI Usage** — direct tool invocation:
   ```bash
   # Connect
   asteria call comet_connect

   # Ask a question
   asteria call comet_ask '{"prompt": "What is 2+2?"}'

   # Check status
   asteria call comet_poll

   # Wait for completion
   asteria call comet_wait

   # Screenshot
   asteria call comet_screenshot '{"format": "jpeg"}'

   # Switch mode
   asteria call comet_mode '{"mode": "deep-research"}'

   # Get sources
   asteria call comet_get_sources

   # List tabs
   asteria call comet_list_tabs

   # Get page content
   asteria call comet_get_page_content '{"maxLength": 5000}'

   # List conversations
   asteria call comet_list_conversations

   # Open a conversation
   asteria call comet_open_conversation '{"url": "https://www.perplexity.ai/search/abc123"}'
   ```

6. **Programmatic Usage** — Node.js integration:
   ```javascript
   import { spawn } from 'node:child_process'

   const child = spawn('asteria', ['start'], { stdio: ['pipe', 'pipe', 'pipe'] })

   // Send initialize
   child.stdin.write(JSON.stringify({
     jsonrpc: '2.0', id: 0, method: 'initialize',
     params: {
       protocolVersion: '2024-11-05',
       capabilities: {},
       clientInfo: { name: 'my-app', version: '1.0.0' }
     }
   }) + '\n')

   // After initialized notification, call a tool
   child.stdin.write(JSON.stringify({
     jsonrpc: '2.0', id: 1, method: 'tools/call',
     params: { name: 'comet_ask', arguments: { prompt: 'What is 2+2?' } }
   }) + '\n')

   child.stdout.on('data', (chunk) => {
     // Parse JSON-RPC responses
     for (const line of chunk.toString().split('\n')) {
       if (!line.trim()) continue
       const msg = JSON.parse(line)
       if (msg.id === 1) console.log(msg.result)
     }
   })
   ```

**Step 2: Verify file**

Run: `wc -l docs/integration.md`
Expected: ~150-200 lines

**Step 3: Commit**

```bash
git add docs/integration.md
git commit -m "docs: add integration guide for MCP clients and CLI"
```

---

### Task 4: Create docs/troubleshooting.md

**Files:**
- Create: `docs/troubleshooting.md`

**Step 1: Write docs/troubleshooting.md**

Structure:

1. **Connection Issues**

   **"Comet not found" / `COMET_NOT_FOUND`**
   - Asteria cannot find the Comet executable
   - Fix: Set `COMET_PATH` environment variable to the full path
   - macOS: `/Applications/Perplexity\ Comet.app/Contents/MacOS/comet`
   - Windows: `C:\Users\<you>\AppData\Local\Perplexity\Comet\comet.exe`
   - Verify: `asteria detect`

   **"Debug port not reachable" / `CDP_CONNECTION_FAILED`**
   - Comet is running but the debug port (9222) is not accessible
   - Fix: Launch Comet with `--remote-debugging-port=9222`
   - Verify: `curl http://127.0.0.1:9222/json/version`

   **"Connection refused"**
   - Comet is not running or using a different port
   - Fix: Start Comet, or set `ASTERIA_PORT` to the correct port
   - Verify: `asteria detect` shows "active" for debug port

2. **Tool Issues**

   **"Agent is still working"**
   - `comet_ask` returned before the agent finished
   - Fix: Call `comet_wait` to poll until completion, or increase timeout
   - Example: `asteria call comet_wait '{"timeout": 300000}'`

   **"Empty response"**
   - Agent may not have finished processing
   - Fix: Use `comet_poll` to check status, then `comet_wait` for full result
   - Check: `comet_screenshot` to see current page state

   **"Mode switch failed: typeahead menu did not appear"**
   - Mode switching only works on the home page or a new chat page
   - Fix: The `newChat` parameter in `comet_ask` automatically navigates to a fresh page
   - Note: Mode switch uses "/" slash command in Comet's input field

   **"No sources found"**
   - Short queries may not generate citations
   - Fix: Sources are only available after a query with citations. Try `comet_screenshot` to verify
   - Collapsed citations (e.g. `wsj+3`) are auto-expanded

   **"No stop button found"**
   - No agent is currently running
   - Fix: This is expected if no query is active

3. **Error Codes**

   | Code | Class | Meaning |
   |------|-------|---------|
   | `CDP_CONNECTION_FAILED` | CDPConnectionError | Cannot connect to Chrome DevTools Protocol |
   | `COMET_NOT_FOUND` | CometNotFoundError | Comet executable not found on system |
   | `COMET_LAUNCH_FAILED` | CometLaunchError | Comet executable found but failed to start |
   | `TAB_NOT_FOUND` | TabNotFoundError | No tab matches the given ID or title |
   | `TIMEOUT` | TimeoutError | Operation exceeded the configured timeout |
   | `EVALUATION_FAILED` | EvaluationError | JavaScript evaluation failed in the browser |
   | `SELECTOR_NOT_FOUND` | SelectorError | CSS selector did not match any element |
   | `AGENT_ERROR` | AgentError | Agent-specific error during operation |
   | `CONFIG_ERROR` | ConfigurationError | Invalid configuration value |

   All errors return: `{ content: [{ type: "text", text: "[CODE] message" }], isError: true }`

4. **Debug Mode**

   Set `ASTERIA_LOG_LEVEL=debug` for verbose logging:
   ```bash
   ASTERIA_LOG_LEVEL=debug asteria start
   ```

   Key log messages:
   - `Auto-connecting to Comet...` — triggered by ensureConnected()
   - `Detected Comet Chrome/145` — version detection succeeded
   - `Type result: ...` — prompt input evaluation
   - `Submit result: ...` — prompt submission result

5. **Health Check**

   ```bash
   asteria detect
   ```

   This prints:
   - Whether Comet process is running
   - The Comet executable path
   - Debug port status (active/not responding/not reachable)
   - Browser version if connected

**Step 2: Verify file**

Run: `wc -l docs/troubleshooting.md`
Expected: ~150-200 lines

**Step 3: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "docs: add troubleshooting guide with error codes"
```

---

### Task 5: Update docs/architecture.md

**Files:**
- Modify: `docs/architecture.md`

**Step 1: Rewrite docs/architecture.md**

Update and expand from current brief version. New structure:

1. **Overview** — Three-layer architecture diagram (keep current, update 12 → 13 tools):
   ```
   MCP Tools (13 tools)
       ↓
   UI Automation (selectors, input, status, extraction, navigation)
       ↓
   CDP Transport (browser launch, connection, tabs, client)
       ↓
   Perplexity Comet Browser (Chromium)
   ```

2. **MCP Layer** — 13 tools grouped by function:
   - Session: connect, poll, wait, stop
   - Query: ask, mode
   - Content: screenshot, get_sources, get_page_content
   - Navigation: list_tabs, switch_tab, list_conversations, open_conversation

3. **UI Automation Layer**:
   - **Selector Strategy Pattern** (keep current description)
   - **Typeahead Mode Detection** — reads SVG icon href from typeahead menu items with `.bg-subtle` class
   - **Collapsed Citation Expansion** — clicks collapsed citations (`wsj+3` pattern) to reveal full URLs
   - **Prompt Injection** — uses `execCommand('insertText')` for safe injection into Lexical editor via `JSON.stringify`

4. **CDP Transport Layer**:
   - **Version Detection** (keep current, expand)
   - **Connection Management** (keep current)
   - **Auto-Reconnect** — health checks via `1+1` evaluation, exponential backoff

5. **Error Handling** (keep, update to 9 subclasses with code table)

6. **Data Flow: comet_ask lifecycle**:
   ```
   1. ensureConnected() — auto-connect if needed
   2. Pre-send state capture (proseCount, lastProseText)
   3. Type prompt via execCommand('insertText')
   4. Submit via Enter key
   5. Polling loop (config.pollInterval)
      - Check agent status (working/idle/completed)
      - Detect new response via proseCount growth
      - Stall detection (10 polls without growth → break)
   6. Response settle (5 x 1s polls to ensure complete text)
   7. Return response + steps
   ```

**Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: expand architecture with v1.1 features"
```

---

### Task 6: Update docs/configuration.md

**Files:**
- Modify: `docs/configuration.md`

**Step 1: Update docs/configuration.md**

The current file is already good. Changes needed:
- Verify `ASTERIA_RESPONSE_TIMEOUT` default is 180000 (confirmed in `src/config.ts` via `src/server.ts` which uses `config.responseTimeout` — check actual default)
- Add `ASTERIA_USER_DATA_DIR` description improvement
- Add `ASTERIA_WINDOW_WIDTH` and `ASTERIA_WINDOW_HEIGHT` descriptions
- Add a "Quick Reference" section with the most commonly used variables
- Add config file example with all variables shown

**Step 2: Commit**

```bash
git add docs/configuration.md
git commit -m "docs: update configuration reference"
```

---

### Task 7: Update docs/contributing.md

**Files:**
- Modify: `docs/contributing.md`

**Step 1: Expand docs/contributing.md**

Current is minimal (35 lines). Expand to:

1. **Setup** (keep current, add `npm run typecheck`)
2. **Development** (keep current commands)
3. **Project Structure**:
   ```
   src/
     cli.ts          — CLI entry point
     server.ts       — MCP server + tool handlers
     config.ts       — Configuration loading + validation
     errors.ts       — Error classes (9 subclasses)
     cdp/            — Chrome DevTools Protocol layer
       browser.ts    — Browser detection + launching
       client.ts     — CDP client (singleton, auto-reconnect)
       connection.ts — WebSocket connection
       tabs.ts       — Tab categorization
     ui/             — UI automation scripts
       input.ts      — Prompt injection (safe, JSON.stringify-based)
       navigation.ts — Mode switch + submit
       status.ts     — Agent status detection
       extraction.ts — Source + page content extraction
       conversations.ts — Conversation listing
       selectors.ts  — Selector strategy runner
       stop.ts       — Agent stop
     selectors/      — Version-specific CSS selectors
       v145.ts       — Chrome 145 selector set
       types.ts      — SelectorSet interface
       index.ts      — Version registry
   tests/
     unit/           — Unit tests (mocked CDP)
     integration/    — Integration tests (real tool shapes)
   ```

4. **Testing Strategy**:
   - Unit tests: mock CDP client, test UI scripts, test config validation
   - Integration tests: test tool shapes match server definitions
   - Run: `npm test` (314 tests)
   - Coverage: `npm run test:ci`

5. **Code Style** (keep current)
6. **Adding Comet Versions** (keep current, expand step-by-step)
7. **Commit Messages** (keep current conventional commits)
8. **PR Process**:
   - All PRs must pass CI (biome lint + vitest)
   - Use conventional commit prefixes
   - Update tests for new features
   - Update docs for user-facing changes

**Step 2: Commit**

```bash
git add docs/contributing.md
git commit -m "docs: expand contributing guide with testing and project structure"
```

---

### Task 8: Update docs/comet-compatibility.md

**Files:**
- Modify: `docs/comet-compatibility.md`

**Step 1: Expand docs/comet-compatibility.md**

Current is very thin (15 lines). Expand to:

1. **Supported Versions** (keep current table)
2. **How Version Detection Works**:
   - On `comet_connect`, Asteria queries `http://127.0.0.1:9222/json/version`
   - Extracts Chrome major version (e.g. `145` from `Chrome/145.2.7632.4587`)
   - Looks up matching selector set in `src/selectors/index.ts`
   - Falls back to latest known set if version is unknown

3. **Selector Strategy Pattern**:
   - Selectors are ordered arrays of CSS selectors
   - Each strategy tries selectors in order until one matches
   - New selectors go at the front, old ones become fallbacks
   - This makes the system resilient to UI changes

4. **Adding a New Comet Version** (expand from current):
   1. Run `asteria detect` to confirm Comet version
   2. Use browser DevTools to inspect DOM elements
   3. Create `src/selectors/v{version}.ts` implementing `SelectorSet` interface
   4. Copy selectors from the latest version and update as needed
   5. Register in `src/selectors/index.ts` version map
   6. Add unit tests for new selectors
   7. Test with real Comet instance
   8. Update this table

**Step 2: Commit**

```bash
git add docs/comet-compatibility.md
git commit -m "docs: expand Comet compatibility guide with selector strategy"
```

---

### Task 9: Final verification

**Step 1: Check all doc files exist and have content**

```bash
ls -la README.md docs/tools.md docs/integration.md docs/troubleshooting.md docs/architecture.md docs/configuration.md docs/contributing.md docs/comet-compatibility.md
```

Expected: All 8 files exist with non-zero size.

**Step 2: Check README links are valid**

```bash
grep -o '\[.*\](docs/[^)]*)' README.md | while read link; do
  file=$(echo "$link" | sed 's/.*](\(docs\/[^)]*\))/\1/')
  if [ ! -f "$file" ]; then echo "BROKEN: $file"; fi
done
```

Expected: No broken links.

**Step 3: Check tool count consistency**

```bash
grep -c 'comet_' docs/tools.md
grep -c '13 tools' README.md docs/architecture.md
```

Expected: 13 tool sections, consistent count mentions.

**Step 4: Run lint to make sure no files are malformed**

```bash
npm run lint
npm test
```

Expected: All pass.
