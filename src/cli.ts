#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))

function printUsage(): void {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`asteria v${version} — MCP server for Perplexity Comet browser

USAGE:
  asteria [command]

COMMANDS:
  start       Start MCP stdio server (default)
  call        Invoke an MCP tool directly
  detect      Detect Comet installation and print info
  --version   Print version
  --help      Print this help message

TOOL CALL:
  asteria call <tool> [json_args]
  asteria call comet_connect
  asteria call comet_ask '{"prompt": "What is 2+2?"}'
  asteria call comet_poll
  asteria call comet_screenshot '{"format": "jpeg"}'
  asteria call comet_list_tabs
  asteria call comet_mode '{"mode": "deep-research"}'
  asteria call comet_get_sources
  asteria comet_stop`)
}

function printVersion(): void {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`asteria v${version}`)
}

async function runDetect(): Promise<void> {
  const { getCometPath, isCometProcessRunning } = await import('./cdp/browser.js')

  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error('Asteria Detect — Comet Browser Status\n')

  const running = isCometProcessRunning()
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`  Comet process: ${running ? 'running' : 'not running'}`)

  try {
    const path = getCometPath()
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`  Comet path:    ${path}`)
  } catch {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('  Comet path:    NOT FOUND')
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('  Set COMET_PATH env var or install Perplexity Comet:')
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('    https://comet.perplexity.ai/')
  }

  try {
    const resp = await fetch('http://127.0.0.1:9222/json/version', {
      signal: AbortSignal.timeout(2000),
    })
    if (resp.ok) {
      const data = await resp.json()
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error('  Debug port:    9222 (active)')
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error(`  Browser:      ${data.Browser}`)
    } else {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error('  Debug port:    9222 (not responding)')
    }
  } catch {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('  Debug port:    9222 (not reachable)')
  }
}

const TOOLS = [
  'comet_connect',
  'comet_ask',
  'comet_poll',
  'comet_stop',
  'comet_screenshot',
  'comet_mode',
  'comet_list_tabs',
  'comet_switch_tab',
  'comet_get_sources',
  'comet_list_conversations',
  'comet_open_conversation',
  'comet_get_page_content',
] as const

/**
 * Invoke a single MCP tool via JSON-RPC over stdio.
 * Spawns the MCP server, sends initialize + tools/call, prints result, exits.
 */
async function runCall(args: string[]): Promise<void> {
  const toolName = args[0]
  const argsStr = args[1] || '{}'

  if (!toolName) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error('Usage: asteria call <tool> [json_args]')
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Available tools: ${TOOLS.join(', ')}`)
    process.exit(1)
  }

  if (!TOOLS.includes(toolName as (typeof TOOLS)[number])) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Unknown tool: ${toolName}`)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Available: ${TOOLS.join(', ')}`)
    process.exit(1)
  }

  let params: Record<string, unknown>
  try {
    params = JSON.parse(argsStr)
  } catch {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Invalid JSON: ${argsStr}`)
    process.exit(1)
  }

  const requestId = 1

  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'asteria-cli', version: `v${version}` },
    },
  })

  const toolMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: toolName, arguments: params },
  })

  const initializedNotif = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  })

  const { spawn } = await import('node:child_process')

  const child = spawn(process.execPath, [resolve(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  let buffer = ''
  let responded = false

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)

        if (msg.id === 0 && msg.result) {
          child.stdin.write(initializedNotif + '\n')
          child.stdin.write(toolMsg + '\n')
          continue
        }

        if (msg.id === requestId && !responded) {
          responded = true
          if (msg.error) {
            // biome-ignore lint/suspicious/noConsole: CLI output
            console.error(`Error: ${JSON.stringify(msg.error)}`)
            shutdown(1)
            return
          }
          if (msg.result?.content) {
            for (const content of msg.result.content) {
              if (content.type === 'text') {
                // biome-ignore lint/suspicious/noConsole: CLI output
                console.log(content.text)
              } else if (content.type === 'image' && content.data) {
                const ext = content.mimeType === 'image/jpeg' ? 'jpg' : 'png'
                const filename = `asteria-screenshot-${Date.now()}.${ext}`
                writeFileSync(filename, Buffer.from(content.data, 'base64'))
                // biome-ignore lint/suspicious/noConsole: CLI output
                console.error(`Screenshot saved: ${filename}`)
              }
            }
          }
          shutdown(0)
        }
      } catch {
        // Ignore non-JSON lines
      }
    }
  })

  child.stderr.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim()
    if (msg) console.error(`[asteria] ${msg}`)
  })

  function shutdown(code: number): void {
    try {
      child.stdin.end()
    } catch {}
    setTimeout(() => process.exit(code), 300)
  }

  // Start handshake
  child.stdin.write(initMsg + '\n')

  // Timeout after 3 minutes
  setTimeout(() => {
    if (!responded) {
      // biome-ignore lint/suspicious/noConsole: CLI output
      console.error('Timeout: no response from server (180s)')
      shutdown(1)
    }
  }, 180000)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === '--help' || command === '-h') {
    printUsage()
    return
  }

  if (command === '--version' || command === '-v') {
    printVersion()
    return
  }

  if (command === 'detect') {
    await runDetect()
    return
  }

  if (command === 'call') {
    await runCall(args.slice(1))
    return
  }

  if (command && command !== 'start') {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error(`Unknown command: ${command}`)
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.error("Run 'asteria --help' for usage.")
    process.exit(1)
  }

  const { startServer } = await import('./server.js')
  await startServer()
}

main().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: error output
  console.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
