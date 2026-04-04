import { describe, expect, it } from 'vitest'
import { buildGetAgentStatusScript } from '../../../src/ui/status.js'

describe('buildGetAgentStatusScript', () => {
  it('generates valid JS with status fields', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('status')
    expect(s).toContain('steps')
    expect(s).toContain('hasStopButton')
    expect(s).toContain('response')
  })
  it('includes working text patterns', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('Working')
    expect(s).toContain('Searching')
    expect(s).toContain('Clicking')
    expect(s).toContain('Typing:')
    expect(s).toContain('Navigating to')
  })
  it('includes step extraction regexes', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('Preparing to assist')
    expect(s).toContain('Found')
  })
  it('includes stop button detection', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('stop')
    expect(s).toContain('cancel')
    expect(s).toContain('rect')
  })
})
