#!/usr/bin/env node
import { readFileSync } from 'node:fs'
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
  detect      Detect Comet installation and print info
  --version   Print version
  --help      Print this help message`)
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
