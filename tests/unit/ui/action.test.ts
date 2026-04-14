import { describe, expect, it } from 'vitest'
import { buildClickActionButtonScript } from '../../../src/ui/action.js'

describe('buildClickActionButtonScript', () => {
  describe('primary action', () => {
    it('wraps in IIFE', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toMatch(/\(function\(\)/)
      expect(s).toMatch(/\}\)\(\)/)
    })

    it('looks for action banner containers', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('@container/banner')
    })

    it('detects primary buttons by bg-button-bg class', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('bg-button-bg')
    })

    it('detects cancel buttons by border-subtle class', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('border-subtle')
    })

    it('clicks the target button', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('.click()')
    })

    it('returns JSON result with clicked status', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('clicked:')
      expect(s).toContain('buttonText:')
    })

    it('skips Show more buttons', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('Show more')
    })

    it('has fallback for buttons without bg-button-bg', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('fallback')
    })

    it('returns clicked: false when no banner found', () => {
      const s = buildClickActionButtonScript('primary')
      expect(s).toContain('No action banner found')
      expect(s).toContain('clicked: false')
    })
  })

  describe('cancel action', () => {
    it('targets cancelBtn when action is cancel', () => {
      const s = buildClickActionButtonScript('cancel')
      expect(s).toContain('cancelBtn')
      expect(s).toContain('cancel')
    })

    it('detects cancel by border-subtle class or Cancel text', () => {
      const s = buildClickActionButtonScript('cancel')
      expect(s).toContain('border-subtle')
      expect(s).toContain("'cancel'")
    })
  })
})
