# Integration Guide

This guide explains how to integrate MCP Comet with MCP clients, use it from the command line, and embed it in Node.js applications.

---

## 1. Overview

MCP Comet communicates via the MCP stdio transport. The MCP client spawns `mcp-comet start` as a subprocess and exchanges JSON-RPC 2.0 messages over stdin/stdout. There is no HTTP server and no port to configure for the MCP layer itself -- the stdio pipe is the transport.

Under the hood, MCP Comet connects to the Perplexity Comet browser over Chrome DevTools Protocol (CDP) on port 9222. From the MCP client's perspective, all of that is invisible: you invoke tools and receive results.

---

## 2. Prerequisites

Before configuring any MCP client, verify the following:

- **Node.js >= 18** is installed. Run `node --version` to confirm.
- **Perplexity Comet** is installed from [https://comet.perplexity.ai/](https://comet.perplexity.ai/).
- **Comet is running**. MCP Comet auto-detects it on port 9222. If Comet is not running, `comet_connect` will attempt to launch it automatically.
- **MCP Comet is installed globally**:

  ```bash
  npm install -g @onestepat4time/mcp-comet
  ```

**Verify the setup:**

```bash
mcp-comet detect
```

This should report that Comet is running and the debug port is active. If it reports that Comet was not found, start Comet manually and run `mcp-comet detect` again.

---

## 3. Claude Code

Claude Code reads MCP server configuration from `~/.claude/claude_desktop_config.json`. Add MCP Comet as a stdio server:

```json
{
  "mcpServers": {
    "mcp-comet": {
      "type": "stdio",
      "command": "mcp-comet",
      "args": ["start"]
    }
  }
}
```

After updating the configuration file, restart Claude Code. MCP Comet will appear as an MCP server exposing 13 tools.

**Verify:** Ask Claude "What MCP tools do you have available?" The list should include `comet_connect`, `comet_ask`, `comet_wait`, and the other tools documented in [tools.md](tools.md).

**Example session:**

```
You: Ask Perplexity what the latest AI research papers are this week.

Claude: [calls comet_connect, then comet_ask with the prompt]
        "Here are the latest AI research papers..." [response from Comet with sources]
```

---

## 4. Cursor

Cursor reads MCP server configuration from `~/.cursor/mcp.json`. Add MCP Comet with the same stdio configuration:

```json
{
  "mcpServers": {
    "mcp-comet": {
      "type": "stdio",
      "command": "mcp-comet",
      "args": ["start"]
    }
  }
}
```

After updating the configuration file, restart Cursor. Open **Settings > MCP** to confirm that `mcp-comet` appears in the server list with an active status.

---

## 5. Other MCP Clients (Generic)

Any MCP-compatible client that supports the stdio transport can use MCP Comet. The configuration pattern is always the same:

| Field      | Value         |
|------------|---------------|
| Command    | `mcp-comet`     |
| Args       | `["start"]`   |
| Transport  | `stdio`       |

Consult your client's documentation for where to place MCP server definitions. Some clients use JSON config files with an `mcpServers` key; others expose a settings UI.

---

## 6. CLI Usage

MCP Comet provides a `call` subcommand for invoking tools directly from the terminal, outside of any MCP client. This is useful for debugging, scripting, and manual testing.

```bash
# Connect to Comet
mcp-comet call comet_connect

# Submit a question
mcp-comet call comet_ask '{"prompt": "What is 2+2?"}'

# Wait for completion
mcp-comet call comet_wait

# Check the current status
mcp-comet call comet_poll

# Take a screenshot
mcp-comet call comet_screenshot '{"format": "jpeg"}'

# Switch mode
mcp-comet call comet_mode '{"mode": "deep-research"}'

# Get sources from the current response
mcp-comet call comet_get_sources

# List open browser tabs
mcp-comet call comet_list_tabs

# Switch to a specific tab
mcp-comet call comet_switch_tab '{"tabId": "ABC123"}'

# Stop the current Comet operation
mcp-comet call comet_stop

# Get page content
mcp-comet call comet_get_page_content '{"maxLength": 5000}'

# List conversations
mcp-comet call comet_list_conversations

# Open a conversation by URL
mcp-comet call comet_open_conversation '{"url": "https://www.perplexity.ai/search/abc123"}'
```

The `call` command sends a single JSON-RPC request over stdio and prints the response to stdout. Arguments are parsed as JSON; omit them for tools that take no parameters.

---

## 7. Programmatic Usage (Node.js)

You can spawn MCP Comet from a Node.js application and communicate via JSON-RPC over stdio. This is useful when you want to embed Perplexity Comet access in your own tooling without relying on an external MCP client.

```javascript
import { spawn } from 'node:child_process'

const child = spawn('mcp-comet', ['start'], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

// Send MCP initialize message
child.stdin.write(
  JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'my-app', version: '1.0.0' },
    },
  }) + '\n',
)

// Listen for responses
let buffer = ''
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString()
  const lines = buffer.split('\n')
  buffer = lines.pop()

  for (const line of lines) {
    if (!line.trim()) continue
    const msg = JSON.parse(line)

    // After initialize response, send initialized notification + tool call
    if (msg.id === 0 && msg.result) {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }) + '\n',
      )
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'comet_ask',
            arguments: { prompt: 'What is 2+2?' },
          },
        }) + '\n',
      )
    }

    // comet_ask is fire-and-forget; then block with comet_wait
    if (msg.id === 1 && msg.result) {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'comet_wait',
            arguments: {},
          },
        }) + '\n',
      )
    }

    // Handle final response
    if (msg.id === 2 && msg.result) {
      console.log(msg.result.content[0].text)
    }
  }
})

child.stderr.on('data', (chunk) => {
  // MCP Comet logs go to stderr
  process.stderr.write(chunk)
})
```

Key points:

- Each JSON-RPC message must be a single line terminated with `\n`.
- After sending `initialize`, you must send a `notifications/initialized` notification before making tool calls.
- MCP Comet writes diagnostic logs to stderr, so stdout remains clean JSON-RPC traffic.
- The `protocolVersion` must be `2024-11-05`, which is the version MCP Comet implements.

