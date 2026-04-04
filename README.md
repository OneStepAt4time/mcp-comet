# Asteria

MCP server for Perplexity Comet browser management via Chrome DevTools Protocol.

## Install

```bash
npm install -g asteria
```

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

## CLI

```bash
asteria start       # Start MCP stdio server (default)
asteria detect      # Detect Comet installation
asteria --version   # Print version
asteria --help      # Print help
```

## Tools

| Tool | Description |
|------|-------------|
| `comet_connect` | Connect to or launch Perplexity Comet |
| `comet_ask` | Send a prompt and wait for response |
| `comet_poll` | Check current agent status |
| `comet_stop` | Stop the running agent |
| `comet_screenshot` | Capture tab screenshot |
| `comet_mode` | Get or switch search mode |
| `comet_list_tabs` | List categorized browser tabs |
| `comet_switch_tab` | Switch to a specific tab |
| `comet_get_sources` | Extract response sources |
| `comet_list_conversations` | List recent conversations |
| `comet_open_conversation` | Open a conversation URL |
| `comet_get_page_content` | Extract page text content |

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `ASTERIA_PORT` | 9222 | CDP debug port |
| `COMET_PATH` | auto-detect | Path to Comet executable |
| `ASTERIA_LOG_LEVEL` | info | Log level (debug/info/warn/error) |
| `ASTERIA_TIMEOUT` | 30000 | Launch timeout (ms) |
| `ASTERIA_RESPONSE_TIMEOUT` | 120000 | Response poll timeout (ms) |
| `ASTERIA_POLL_INTERVAL` | 1000 | Status poll interval (ms) |

## Requirements

- Node.js >= 18
- Perplexity Comet browser installed

## License

MIT
