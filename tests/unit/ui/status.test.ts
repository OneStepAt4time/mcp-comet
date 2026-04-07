import { describe, expect, it } from 'vitest'
import { buildGetAgentStatusScript } from '../../../src/ui/status.js'
import { SELECTORS } from '../../../src/ui/selectors.js'

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

  // Edge case tests
  it('accepts custom selectors parameter', () => {
    const customSelectors = {
      ...SELECTORS,
      LOADING: new Set(['.custom-spinner', '.custom-loading']),
    }
    const s = buildGetAgentStatusScript(customSelectors)
    expect(s).toContain('.custom-spinner')
    expect(s).toContain('.custom-loading')
  })

  it('truncates response at 8000 chars', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('8000')
    expect(s).toContain('substring')
  })

  it('includes step pattern extraction', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('stepPatterns')
    expect(s).toContain('seenSteps')
  })

  it('detects working patterns including Working, Searching, Navigating to', () => {
    const s = buildGetAgentStatusScript()
    expect(s).toContain('workingPatterns')
    expect(s).toContain('hasWorkingText')
    // Verify all required patterns
    expect(s).toContain('Working')
    expect(s).toContain('Searching')
    expect(s).toContain('Navigating to')
  })
})
