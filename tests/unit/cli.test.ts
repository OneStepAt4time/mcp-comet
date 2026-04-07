import { describe, expect, it } from 'vitest'
import { execSync, spawnSync } from 'node:child_process'

const CLI_PATH = 'node dist/cli.js'

function runCli(args: string): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync('node', ['dist/cli.js', ...args.split(' ')], {
    encoding: 'utf-8',
    shell: false,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  }
}

describe('CLI', () => {
  it('--help prints usage', () => {
    const { stderr } = runCli('--help')
    expect(stderr).toContain('asteria')
    expect(stderr).toContain('USAGE')
    expect(stderr).toContain('COMMANDS')
  })

  it('-h prints usage (short form)', () => {
    const { stderr } = runCli('-h')
    expect(stderr).toContain('asteria')
    expect(stderr).toContain('USAGE')
  })

  it('--version prints version', () => {
    const { stderr } = runCli('--version')
    expect(stderr).toMatch(/asteria v\d+\.\d+\.\d+/)
  })

  it('-v prints version (short form)', () => {
    const { stderr } = runCli('-v')
    expect(stderr).toMatch(/asteria v\d+\.\d+\.\d+/)
  })

  it('unknown command exits with error', () => {
    const { stderr, status } = runCli('foobar')
    expect(status).toBe(1)
    expect(stderr).toContain('Unknown command')
  })

  it('call without tool name shows usage', () => {
    const { stderr, status } = runCli('call')
    expect(status).toBe(1)
    expect(stderr).toContain('Usage: asteria call')
  })

  it('call with unknown tool shows error', () => {
    const { stderr, status } = runCli('call unknown_tool')
    expect(status).toBe(1)
    expect(stderr).toContain('Unknown tool')
  })

  it('call with invalid JSON shows error', () => {
    const { stderr, status } = runCli('call comet_connect invalid-json')
    expect(status).toBe(1)
    expect(stderr).toContain('Invalid JSON')
  })
})
