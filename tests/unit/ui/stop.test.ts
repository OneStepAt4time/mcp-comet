import { describe, expect, it } from 'vitest'
import { buildStopAgentScript } from '../../../src/ui/stop.js'

describe('buildStopAgentScript', () => {
  it('wraps in IIFE', () => {
    const s = buildStopAgentScript()
    expect(s).toMatch(/\(function\(\)/)
    expect(s).toMatch(/\}\)\(\)/)
  })

  it('includes stop aria-label check', () => {
    const s = buildStopAgentScript()
    expect(s).toContain('stop')
    expect(s).toContain('aria-label')
    expect(s).toContain('toLowerCase')
  })

  it('includes cancel aria-label check', () => {
    const s = buildStopAgentScript()
    expect(s).toContain('cancel')
  })

  it('includes svg rect check', () => {
    const s = buildStopAgentScript()
    expect(s).toContain('svg rect')
    expect(s).toContain('querySelector')
  })

  it('returns stopped on success', () => {
    const s = buildStopAgentScript()
    expect(s).toContain("return 'stopped'")
  })

  it('returns not_found when no button', () => {
    const s = buildStopAgentScript()
    expect(s).toContain("return 'not_found'")
  })

  it('queries all buttons', () => {
    const s = buildStopAgentScript()
    expect(s).toContain("document.querySelectorAll('button')")
  })

  it('clicks matching buttons', () => {
    const s = buildStopAgentScript()
    expect(s).toContain('.click()')
  })
})
