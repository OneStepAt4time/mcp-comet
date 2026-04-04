<p align="center">
  <img src="docs/assets/banner.svg" alt="Asteria Banner" width="800">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/asteria"><img src="https://img.shields.io/npm/v/asteria?style=flat-square&color=6366f1" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/asteria"><img src="https://img.shields.io/npm/dm/asteria?style=flat-square&color=6366f1" alt="npm downloads"></a>
  <a href="https://github.com/OneStepAt4time/asteria/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/asteria?style=flat-square" alt="license"></a>
  <a href="https://github.com/OneStepAt4time/asteria"><img src="https://img.shields.io/node/v/asteria?style=flat-square&color=6366f1" alt="node version"></a>
  <a href="https://github.com/OneStepAt4time/asteria/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/OneStepAt4time/asteria/ci.yml?branch=master&style=flat-square&label=CI" alt="CI"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-6366f1?style=flat-square" alt="MCP"></a>
</p>

---

## What is Asteria?

Asteria is an [MCP server](https://modelcontextprotocol.io) that gives any AI assistant direct control over [Perplexity Comet](https://comet.perplexity.ai/) — the agentic browser that researches, browses, and answers questions autonomously.

It connects via Chrome DevTools Protocol, so your AI agent can ask questions, follow up, extract sources, manage tabs, and monitor Comet's research progress — all through standard MCP tools.

```mermaid
graph LR
    A["Claude / GPT / Gemini"] -->|"MCP stdio"| B["Asteria"]
    B -->|"CDP WebSocket"| C["Comet Browser"]
    C -->|"HTTP requests"| D["Web Pages"]
    D -->|"Response + Sources"| C
    C -->|"Research results"| B
    B -->|"Formatted response"| A
```

## Demo

<p align="center">
  <img src="docs/assets/demo.gif" alt="Asteria Demo" width="720">
  <br>
  <em>Claude Code asks a question through Asteria → Comet researches and responds → the agent continues its workflow</em>
</p>

## Features

- **12 MCP tools** — connect, ask, poll, stop, screenshot, mode switch, tab management, source extraction, conversation history
- **Non-blocking polling** — submit a prompt and poll for completion; the agent can do other work while Comet researches
- **Auto-detect Comet** — finds the Comet executable on Windows and macOS, launches it with the correct debug port
- **Auto-reconnect** — exponential backoff with health checks; survives Comet restarts without dropping the session
- **Version-aware selectors** — auto-detects Comet's Chrome version and routes to the right CSS selectors
- **Tab categorization** — tracks main, sidecar, agent browsing, and overlay tabs separately
- **Zero browser dependencies** — no Puppeteer or Playwright; uses CDP directly via `chrome-remote-interface`
- **CLI included** — `asteria detect` to check installation, `asteria snapshot` to capture DOM structure

## Install

```bash
npm install -g asteria
```

**Requirements:** Node.js >= 18, [Perplexity Comet](https://comet.perplexity.ai/) installed

## Quick Start

Add to your MCP client configuration:

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

Then connect from your AI assistant:

```
> Ask Perplexity what the latest AI research papers are
```

Asteria will launch (or connect to) Comet, send the query, wait for the full research response, and return it to your assistant.

## How It Works

```mermaid
graph TD
    subgraph "Asteria (MCP Server)"
        A[CLI / MCP Transport] --> B[Tool Handlers]
        B --> C[UI Automation Layer]
        C --> D[Selector Strategies]
        C --> E[Status Detection]
        C --> F[Content Extraction]
        C --> G[Prompt Input + Submit]
    end

    subgraph "CDP Transport"
        H[HTTP /json/*] --> I[WebSocket Client]
        I --> J[Auto-Reconnect + Health Checks]
        J --> K[Tab Categorization]
    end

    B --> I
    J --> L[Comet Browser]
    L --> M[Perplexity AI]
    M --> N[Web Sources]
```

### Connection Flow

1. **`comet_connect`** — checks if Comet is running on port 9222, launches it if not, closes extra tabs
2. **`comet_ask`** — types the prompt into Comet's input field, submits it, polls for completion
3. **Status detection** — monitors stop buttons, spinners, and body text patterns to detect working/idle/completed states
4. **Response extraction** — reads prose elements, filters out UI chrome, returns cleaned response text

## CLI

```bash
asteria start       # Start MCP stdio server (default)
asteria detect      # Detect Comet installation and debug port
asteria --version   # Print version
asteria --help      # Print help
```

## Tools

| Tool | Description | Example Use Case |
|------|-------------|-----------------|
| `comet_connect` | Connect to or launch Perplexity Comet | Start a session before other tools |
| `comet_ask` | Send a prompt and wait for response | "Summarize the latest news about quantum computing" |
| `comet_poll` | Check current agent status | Monitor long research queries |
| `comet_stop` | Stop the running agent | Cancel a query that's taking too long |
| `comet_screenshot` | Capture tab screenshot | Visually verify what Comet is showing |
| `comet_mode` | Get or switch search mode | Switch to Research for deeper analysis |
| `comet_list_tabs` | List categorized browser tabs | See what pages Comet opened during research |
| `comet_switch_tab` | Switch to a specific tab | Read content from an agent-browsing page |
| `comet_get_sources` | Extract response sources | Get the cited URLs from a research response |
| `comet_list_conversations` | List recent conversations | Find a previous search to reference |
| `comet_open_conversation` | Open a conversation URL | Resume a past research session |
| `comet_get_page_content` | Extract page text content | Read what Comet found on a browsed page |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ASTERIA_PORT` | 9222 | CDP debug port |
| `COMET_PATH` | auto-detect | Path to Comet executable |
| `ASTERIA_LOG_LEVEL` | info | Log level (`debug` / `info` / `warn` / `error`) |
| `ASTERIA_TIMEOUT` | 30000 | Comet launch timeout (ms) |
| `ASTERIA_RESPONSE_TIMEOUT` | 120000 | Response poll timeout (ms) |
| `ASTERIA_POLL_INTERVAL` | 1000 | Status poll interval (ms) |
| `ASTERIA_SCREENSHOT_FORMAT` | png | Screenshot format (`png` / `jpeg`) |
| `ASTERIA_MAX_RECONNECT` | 5 | Max reconnection attempts |
| `ASTERIA_RECONNECT_DELAY` | 5000 | Max reconnection backoff delay (ms) |

## Architecture

```mermaid
graph TB
    subgraph "MCP Protocol Layer"
        T1[comet_connect]
        T2[comet_ask]
        T3[comet_poll]
        T4[comet_stop]
        T5[comet_screenshot]
        T6[comet_mode]
        T7[comet_list_tabs]
        T8[comet_switch_tab]
        T9[comet_get_sources]
        T10[comet_list_conversations]
        T11[comet_open_conversation]
        T12[comet_get_page_content]
    end

    subgraph "UI Automation"
        S[Selector Strategies]
        I[Prompt Input]
        ST[Status Detection]
        EX[Content Extraction]
        NV[Navigation]
    end

    subgraph "CDP Transport"
        BR[Browser Launcher]
        CO[WebSocket Connection]
        TA[Tab Management]
    end

    T2 --> I
    T3 --> ST
    T9 --> EX
    T5 --> CO
    T7 --> TA
    I --> S
    ST --> S
    EX --> S
    NV --> S
    CO --> BR
    TA --> CO
```

## Roadmap

- [ ] **MCP Resources** — expose Perplexity pages as MCP resources for direct reading
- [ ] **Streaming responses** — stream Comet responses token-by-token instead of polling
- [ ] **Multi-Comet sessions** — control multiple Comet instances simultaneously
- [ ] **Browser extension** — package as a browser extension for tighter integration

## Contributing

```bash
git clone https://github.com/OneStepAt4time/asteria.git
cd asteria
npm install
npm run build
npm test
```

See [contributing.md](docs/contributing.md) for code style, adding Comet versions, and commit conventions.

## License

MIT &copy; 2026 [OneStepAt4time](https://github.com/OneStepAt4time)
