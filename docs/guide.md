# Asteria Developer Guide: Using Claude Code with Perplexity Comet

> A complete guide for developers who want to use Claude Code (or any MCP client) to interact with Perplexity Comet through Asteria.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Setup](#setup)
3. [Configuring User Profiles](#configuring-user-profiles)
4. [The Prompting Process](#the-prompting-process)
5. [Tool Reference](#tool-reference)
6. [Prompting Patterns](#prompting-patterns)
7. [Response Handling](#response-handling)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Configuration Reference](#configuration-reference)
10. [Troubleshooting](#troubleshooting)

---

## How It Works

Asteria is an MCP (Model Context Protocol) server that bridges your AI assistant with Perplexity Comet — the agentic browser by Perplexity. It connects via Chrome DevTools Protocol (CDP) and automates the Comet UI to send prompts, read responses, manage tabs, and extract data.

```
Claude Code ──MCP stdio──> Asteria ──CDP WebSocket──> Comet Browser ──HTTP──> Web
                                    <──Response+Sources──
          <──Formatted text──────────
```

Asteria does **not** use Puppeteer or Playwright. It talks CDP directly through `chrome-remote-interface`, injecting JavaScript into Comet's pages to read the DOM, type prompts, detect agent status, and extract content.

---

## Setup

### Prerequisites

- Node.js >= 18
- [Perplexity Comet](https://comet.perplexity.ai/) installed
- macOS or Windows (Linux: set `COMET_PATH` manually)

### Install from source

```bash
git clone https://github.com/OneStepAt4time/asteria.git
cd asteria && npm install && npm run build && npm link
```

### Add to Claude Code

Edit your MCP config at `~/.claude/claude_desktop_config.json`:

```json
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

Alternatively, you can pass environment variables directly:

```json
{
  "mcpServers": {
    "asteria": {
      "type": "stdio",
      "command": "asteria",
      "args": ["start"],
      "env": {
        "ASTERIA_USER_DATA_DIR": "/Users/you/Library/Application Support/Comet",
        "ASTERIA_LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Verify installation

```bash
asteria detect
# Should show: Comet process: running/not running, Comet path, debug port status
```

---

## Configuring User Profiles

By default, Comet uses its built-in profile directory (`~/Library/Application Support/Comet/` on macOS). This means if you launch Comet normally (without `--user-data-dir`), it picks up your existing logged-in session, cookies, and history.

### Using your existing Comet profile

If you want Asteria to launch Comet with **your** profile (logged-in account, conversation history), set the `userDataDir` config:

**Option 1: Environment variable**
```bash
export ASTERIA_USER_DATA_DIR="$HOME/Library/Application Support/Comet"
asteria start
```

**Option 2: `asteria.config.json` in your project root**
```json
{
  "userDataDir": "/Users/you/Library/Application Support/Comet"
}
```

**Option 3: MCP client config env block** (recommended for Claude Code)
```json
{
  "mcpServers": {
    "asteria": {
      "type": "stdio",
      "command": "asteria",
      "args": ["start"],
      "env": {
        "ASTERIA_USER_DATA_DIR": "/Users/you/Library/Application Support/Comet"
      }
    }
  }
}
```

### Multiple profiles

You can maintain separate Comet profiles for different use cases (work, personal, testing):

```json
{
  "userDataDir": "/Users/you/.comet-profiles/work"
}
```

Each profile has its own cookies, history, and Perplexity login state. Create a profile by simply pointing to a new directory — Comet will initialize it on first launch.

### Default profile locations

| Platform | Default Path |
|----------|-------------|
| macOS | `~/Library/Application Support/Comet/` |
| Windows | `%LOCALAPPDATA%\Perplexity\Comet\User Data\` |

When `userDataDir` is `null` (the default), Comet uses its built-in path and you don't need to configure anything.

---

## The Prompting Process

When Claude Code calls `comet_ask`, the following sequence happens:

```
1. Pre-send state capture
   └─ Asteria reads the page: how many prose elements exist, what's the last one?
   └─ This establishes a baseline to detect NEW responses vs old ones

2. Type prompt
   └─ JavaScript injects the prompt into Comet's input textarea
   └─ Waits 500ms for React to process

3. Submit
   └─ JavaScript simulates Enter key submission

4. Polling loop (smart polling)
   └─ Every pollInterval (default 1s), reads agent status:
      ├─ status: "working" | "idle" | "completed"
      ├─ proseCount: number of prose elements on page
      ├─ response: extracted text from latest prose element
      └─ hasStopButton / hasLoadingSpinner
   └─ New response detection:
      ├─ PRIMARY: proseCount increased since pre-send → new content appeared
      └─ FALLBACK: no prior prose existed + substantial text appeared → first response
   └─ Auto-extend: if response text is growing, keep polling (resets stall counter)
   └─ Stall detection: 10 consecutive polls with no growth → stop polling
   └─ Completion: status="completed"/"idle" + new response seen → return result

5. Return
   └─ Response text + collected steps to Claude Code
   └─ Or timeout message with partial response if agent didn't finish
```

### Key insight: proseCount

Asteria tracks `proseCount` — the number of prose elements on the page. When you send a second query, the count increases (new prose element added by Comet). This is the primary mechanism for distinguishing new responses from old ones still visible on the page.

---

## Tool Reference

### comet_connect

Connects to a running Comet instance or launches one. Called automatically by other tools if not connected.

**Parameters:** `{ port?: number }`

**When to call:** At the start of a session, or after Comet crashes/restarts. Other tools auto-connect, but explicit connection gives cleaner error messages.

**Returns:** Connection info with Chrome version and target ID.

```
"Connected to Comet on port 9222 (Chrome/145), target F7035431..."
```

### comet_ask

The main tool. Sends a prompt to Comet and waits for the response.

**Parameters:**
```json
{
  "prompt": "Your question here (required)",
  "newChat": false,      // Start fresh conversation
  "timeout": 180000      // Max wait in ms (default: from config)
}
```

**Behavior:**
- Types the prompt into Comet's input field
- Submits and polls until response completes or timeout
- Uses smart polling: auto-extends while response grows, stops after stall
- Returns the full response text + steps taken

**Returns:**
- Success: response text (e.g., `"5+5 equals 10."`)
- Timeout: `"Agent is still working. Use comet_poll to check status."` + partial response + steps

### comet_poll

Reads the current agent status without waiting. Non-blocking.

**Parameters:** `{}`

**Returns:** JSON object:
```json
{
  "status": "idle|working|completed",
  "steps": ["Searching web", "Reading sources"],
  "currentStep": "Reading sources",
  "response": "The full response text so far...",
  "hasStopButton": false,
  "hasLoadingSpinner": false,
  "proseCount": 2
}
```

### comet_stop

Stops the currently running agent. Retries up to 5 times with 1s intervals (agent may not have started yet).

**Parameters:** `{}`

**Returns:** `"Agent stopped."` or `"No stop button found."`

### comet_screenshot

Captures a screenshot of the active Comet tab.

**Parameters:** `{ format?: "png" | "jpeg" }`

**Returns:** Base64-encoded image with MIME type.

### comet_mode

Gets or switches the current Comet mode.

**Parameters:**
```json
{
  "mode": "standard"  // or: deep-research, model-council, create, learn, review, computer
}
```
Omit `mode` (or set to `null`) to query the current mode.

**Modes:**
| Mode | Description |
|------|------------|
| `standard` | Default search mode |
| `deep-research` | Thorough multi-source research |
| `model-council` | Multiple model consensus |
| `create` | Content creation |
| `learn` | Educational explanations |
| `review` | Code/content review |
| `computer` | Computer use agent |

### comet_list_tabs

Lists all browser tabs, categorized by role.

**Returns:**
```
=== Main (1) ===
  [TARGET_ID] Page Title — https://url
=== Sidecar (1) ===
  [TARGET_ID] Sidecar — chrome-extension://...
```

Categories: `Main`, `Sidecar`, `Agent Browsing`, `Overlay`, `Other`.

### comet_switch_tab

Switch to a different tab by ID or title.

**Parameters:**
```json
{ "tabId": "exact-target-id" }
// or
{ "title": "substring of tab title" }
```

### comet_get_sources

Extracts cited sources from the current Comet response.

**Returns:**
```
Sources (3):

1. Research Paper Title
   https://arxiv.org/abs/...

2. News Article Title
   https://example.com/...
```

### comet_list_conversations

Lists recent conversations visible on the page.

**Returns:** Numbered list of conversation titles and URLs.

### comet_open_conversation

Navigates to a specific Perplexity conversation URL. Only allows `https://perplexity.ai/` URLs (SSRF protection).

**Parameters:** `{ "url": "https://www.perplexity.ai/search/..." }`

### comet_get_page_content

Extracts the current page's title and body text.

**Parameters:** `{ "maxLength?: number }` (default: 10000)

---

## Prompting Patterns

### Pattern 1: Simple Factual Query

The most common pattern. Ask a question, get an answer.

```
comet_connect                    // establish connection
comet_ask({ prompt: "..." })     // ask and wait for response
```

Claude Code typically handles connect automatically. Just ask.

### Pattern 2: Deep Research

For complex topics that need thorough analysis.

```
comet_connect
comet_mode({ mode: "deep-research" })
comet_ask({ prompt: "...", timeout: 300000 })   // 5 min timeout for research
```

Deep research takes longer. Increase `timeout` to avoid premature cutoff. After the response, use `comet_get_sources` to extract citations.

### Pattern 3: Sequential Conversation

Multiple queries in the same conversation. Comet remembers context.

```
comet_ask({ prompt: "What is machine learning?" })
// ... process response ...
comet_ask({ prompt: "How does it differ from deep learning?" })
// Comet knows the previous question context
```

Each `comet_ask` without `newChat: true` continues the same conversation. Asteria tracks `proseCount` to correctly identify new responses.

### Pattern 4: Fresh Chat

Start a completely new conversation with no prior context.

```
comet_ask({ prompt: "...", newChat: true })
```

This closes extra tabs, reloads perplexity.ai, and starts a clean session.

### Pattern 5: Research Pipeline

A complete research workflow combining multiple tools.

```
1. comet_connect
2. comet_mode({ mode: "deep-research" })
3. comet_ask({ prompt: "Research topic...", timeout: 300000 })
4. comet_get_sources                           // extract citations
5. comet_screenshot()                          // capture visual state
6. comet_ask({ prompt: "Summarize the key findings..." })  // follow-up
```

### Pattern 6: Browse Agent Tabs

Comet opens tabs during research. You can inspect them.

```
comet_list_tabs()                              // see what Comet opened
comet_switch_tab({ title: "specific page" })   // switch to it
comet_get_page_content({ maxLength: 5000 })    // read the content
```

### Pattern 7: Resume Previous Conversation

```
comet_list_conversations()                     // find a past conversation
comet_open_conversation({ url: "https://..." })  // open it
comet_ask({ prompt: "Follow up on this..." })  // continue from where you left off
```

---

## Response Handling

### What you get back

`comet_ask` returns a text string containing the Comet response. For completed responses:

```
The capital of France is Paris. Paris is both the political capital
and the largest city of France...

Steps:
  - Searching web
  - Reading 3 sources
```

For timed-out responses:

```
Agent is still working. Use comet_poll to check status.

Steps so far:
  - Searching web

Partial response:
  The research shows that...
```

### Smart polling behavior

Asteria uses smart polling to handle varying response times:

- **Auto-extend**: If the response text is growing (getting longer), polling continues even past the nominal timeout. This handles cases where Comet is actively generating text.
- **Stall detection**: If 10 consecutive polls show no growth in response length, Asteria stops polling and returns what it has. This prevents waiting forever on a stalled response.
- **Completion detection**: When `proseCount` increases AND status is `idle`/`completed`, Asteria returns immediately without waiting for the full timeout.

### Getting the full response after timeout

If `comet_ask` times out but Comet is still working:

```
comet_poll()   // check current status and response text
```

Poll until status is `"idle"` or `"completed"`, then read the `response` field.

---

## Error Handling & Recovery

### Auto-reconnect

Asteria automatically reconnects when the CDP connection drops (Comet restart, network issue, tab crash). It uses exponential backoff with configurable attempts:

- Default: 5 attempts with up to 5s delay
- Health checks via JavaScript evaluation (`1+1` test)
- Reconnect is shared across concurrent calls to prevent race conditions

### Error types

| Error Code | Meaning |
|-----------|---------|
| `CDP_CONNECTION_FAILED` | Can't reach Comet on the configured port |
| `EVALUATION_FAILED` | JavaScript injection failed (page changed, tab crashed) |
| `COMET_NOT_FOUND` | Comet executable not found on the system |
| `SCRIPT_ERROR` | Generic script execution failure |

### Common recovery flows

**Comet crashed:**
```
comet_connect()   // reconnects or launches fresh Comet
comet_ask(...)    // resume operation
```

**Tab navigated away:**
```
comet_list_tabs()
comet_switch_tab({ title: "Perplexity" })
// or
comet_connect()   // re-navigates to perplexity.ai
```

**Agent stuck:**
```
comet_stop()      // stop the running agent
comet_ask({ prompt: "...", newChat: true })  // start fresh
```

---

## Configuration Reference

### All config options

| Option | Type | Default | Env Variable | Description |
|--------|------|---------|-------------|-------------|
| `port` | number | `9222` | `ASTERIA_PORT` | CDP debug port |
| `timeout` | number | `30000` | `ASTERIA_TIMEOUT` | Comet launch timeout (ms) |
| `cometPath` | string\|null | `null` | `COMET_PATH` | Path to Comet executable |
| `responseTimeout` | number | `180000` | `ASTERIA_RESPONSE_TIMEOUT` | Max wait for Comet response (ms) |
| `logLevel` | string | `"info"` | `ASTERIA_LOG_LEVEL` | `debug`/`info`/`warn`/`error` |
| `screenshotFormat` | string | `"png"` | `ASTERIA_SCREENSHOT_FORMAT` | `png` or `jpeg` |
| `screenshotQuality` | number | `80` | `ASTERIA_SCREENSHOT_QUALITY` | JPEG quality (1-100) |
| `windowWidth` | number | `1440` | `ASTERIA_WINDOW_WIDTH` | Browser viewport width |
| `windowHeight` | number | `900` | `ASTERIA_WINDOW_HEIGHT` | Browser viewport height |
| `maxReconnectAttempts` | number | `5` | `ASTERIA_MAX_RECONNECT` | Max reconnect tries |
| `maxReconnectDelay` | number | `5000` | `ASTERIA_RECONNECT_DELAY` | Max reconnect backoff (ms) |
| `pollInterval` | number | `1000` | `ASTERIA_POLL_INTERVAL` | Status poll interval (ms) |
| `userDataDir` | string\|null | `null` | `ASTERIA_USER_DATA_DIR` | Comet profile directory |

### Config precedence (low to high)

1. Hardcoded defaults
2. `asteria.config.json` in project root
3. Environment variables
4. Programmatic overrides

---

## Troubleshooting

### "Comet browser not found"

Set the path explicitly:
```bash
export COMET_PATH="/Applications/Comet.app/Contents/MacOS/Comet"
```

### Comet launches but shows a fresh profile (not logged in)

Set your user data directory:
```json
{ "userDataDir": "/Users/you/Library/Application Support/Comet" }
```

### Response comes back as old text from a previous query

This was a known bug fixed in the latest version. Ensure you're on the latest commit. Asteria uses `proseCount` tracking to distinguish new responses.

### "Agent is still working" but response seems complete

The stall detection may have triggered because the response stopped growing while Comet's loading spinner was still active. Call `comet_poll()` to get the current full response — it often contains the complete text even when `comet_ask` returned early.

### Connection keeps dropping

Check that Comet is actually running:
```bash
asteria detect
```

Increase reconnect settings:
```json
{
  "maxReconnectAttempts": 10,
  "maxReconnectDelay": 10000
}
```

### Deep research times out

Increase the response timeout:
```json
{ "responseTimeout": 300000 }
```

Or pass per-query: `comet_ask({ prompt: "...", timeout: 300000 })`.

### Mode switch returns "undefined"

The mode switch uses UI automation (typing `/mode` in the input field). If Comet's UI has changed, the slash command may not work. The script still executes without error — it just doesn't find the expected UI elements. Check `docs/comet-compatibility.md` for supported Comet versions.
