import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getHandler, mocks, registerHandlers, resetHarness } from './harness.js'

describe('UI control tool handlers', () => {
  beforeAll(async () => {
    await registerHandlers()
  })

  beforeEach(() => {
    resetHarness()
  })

  describe('comet_screenshot', () => {
    it('returns PNG format by default', async () => {
      mocks.screenshot.mockResolvedValue('base64pngdata')
      const handler = getHandler('comet_screenshot')
      const result = await handler({})

      expect(result.content[0].type).toBe('image')
      expect(result.content[0].mimeType).toBe('image/png')
      expect(result.content[0].data).toBe('base64pngdata')
    })

    it('returns JPEG format when specified', async () => {
      mocks.screenshot.mockResolvedValue('base64jpegdata')
      const handler = getHandler('comet_screenshot')
      const result = await handler({ format: 'jpeg' })

      expect(result.content[0].type).toBe('image')
      expect(result.content[0].mimeType).toBe('image/jpeg')
      expect(result.content[0].data).toBe('base64jpegdata')
    })

    it('returns error response when screenshot fails', async () => {
      mocks.screenshot.mockRejectedValue(new Error('Screenshot failed'))
      const handler = getHandler('comet_screenshot')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Screenshot failed')
    })
  })

  describe('comet_mode', () => {
    it('returns current mode via URL detection (non-standard)', async () => {
      mocks.safeEvaluate.mockResolvedValue({ result: { value: 'computer' } })
      const handler = getHandler('comet_mode')
      const result = await handler({})

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Current mode: computer')
    })

    it('returns standard mode via typeahead fallback', async () => {
      mocks.safeEvaluate
        // 1st call: URL-based check returns 'standard' → enters typeahead flow
        .mockResolvedValueOnce({ result: { value: 'standard' } })
        // 2nd-11th calls: focus + readActiveMode (5 attempts × 2 calls each)
        .mockResolvedValue({ result: { value: 'standard' } })
      const handler = getHandler('comet_mode')
      const result = await handler({})

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Current mode: standard')
    }, 15000)

    it('switches mode and returns result', async () => {
      mocks.safeEvaluate.mockResolvedValue({ result: { value: 'clicked:#pplx-icon-telescope' } })
      const handler = getHandler('comet_mode')
      const result = await handler({ mode: 'deep-research' })

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Mode switch result')
      expect(result.content[0].text).toContain('clicked:#pplx-icon-telescope')
    }, 15000)

    it('retries mode switch when listbox not immediately available', async () => {
      mocks.safeEvaluate.mockReset()
      mocks.pressKey.mockClear()
      // Input length check (returns 0 → skip clearing) + 3 retry attempts × 3 calls each
      mocks.safeEvaluate
        .mockResolvedValueOnce({ result: { value: 0 } })                    // input length check
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 1: focus
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 1: insertText
        .mockResolvedValueOnce({ result: { value: 'no_listbox_found' } })    // attempt 1: mode switch
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 2: focus
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 2: insertText
        .mockResolvedValueOnce({ result: { value: 'no_listbox_found' } })    // attempt 2: mode switch
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 3: focus
        .mockResolvedValueOnce({ result: { value: undefined } })             // attempt 3: insertText
        .mockResolvedValueOnce({ result: { value: 'clicked:#pplx-icon-telescope' } }) // attempt 3: mode switch
      const handler = getHandler('comet_mode')
      const result = await handler({ mode: 'deep-research' })

      expect(result.content[0].text).toContain('clicked:#pplx-icon-telescope')
      expect(mocks.safeEvaluate).toHaveBeenCalledTimes(10)
    }, 20000)

    it('returns failure after max retries when listbox never appears', async () => {
      mocks.safeEvaluate.mockReset()
      mocks.safeEvaluate.mockResolvedValue({ result: { value: 'no_listbox_found' } })
      const handler = getHandler('comet_mode')
      const result = await handler({ mode: 'deep-research' })

      expect(result.content[0].text).toContain('Mode switch failed')
      // 1 input length check + 10 retries × 3 safeEvaluate calls each (focus + insertText + mode switch) = 31
      expect(mocks.safeEvaluate).toHaveBeenCalledTimes(31)
    }, 30000)

    it('returns error response when safeEvaluate fails', async () => {
      mocks.safeEvaluate.mockRejectedValue(new Error('Evaluate failed'))
      const handler = getHandler('comet_mode')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Evaluate failed')
    })
  })

  describe('comet_list_tabs', () => {
    it('returns categorized tabs', async () => {
      mocks.listTabsCategorized.mockResolvedValue({
        main: [
          { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
        ],
        sidecar: [{ id: 'target-2', url: 'https://example.com', type: 'page', title: 'Sidecar' }],
        agentBrowsing: [],
        overlay: [],
        others: [],
      })
      const handler = getHandler('comet_list_tabs')
      const result = await handler({})

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Main')
      expect(result.content[0].text).toContain('Perplexity')
    })

    it('returns no tabs message when all categories empty', async () => {
      mocks.listTabsCategorized.mockResolvedValue({
        main: [],
        sidecar: [],
        agentBrowsing: [],
        overlay: [],
        others: [],
      })
      const handler = getHandler('comet_list_tabs')
      const result = await handler({})

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('No tabs found')
    })

    it('returns error response when listTabsCategorized fails', async () => {
      mocks.listTabsCategorized.mockRejectedValue(new Error('List failed'))
      const handler = getHandler('comet_list_tabs')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('List failed')
    })
  })

  describe('comet_open_conversation', () => {
    it('rejects domain suffix attack', async () => {
      const handler = getHandler('comet_open_conversation')
      const result = await handler({ url: 'https://perplexity.ai.evil.com/search/123' })
      expect(result.content[0].text).toContain('Error')
    })

    it('rejects path-based bypass', async () => {
      const handler = getHandler('comet_open_conversation')
      const result = await handler({ url: 'https://evil.com/perplexity.ai/' })
      expect(result.content[0].text).toContain('Error')
    })

    it('rejects credential-based URL confusion', async () => {
      const handler = getHandler('comet_open_conversation')
      const result = await handler({ url: 'https://perplexity.ai@evil.com/' })
      expect(result.content[0].text).toContain('Error')
    })

    it('rejects evilperplexity.ai domain suffix attack', async () => {
      const handler = getHandler('comet_open_conversation')
      const result = await handler({ url: 'https://evilperplexity.ai/search/123' })
      expect(result.content[0].text).toContain('Error')
    })

    it('accepts valid perplexity.ai URL', async () => {
      mocks.navigate.mockResolvedValue(undefined)
      const handler = getHandler('comet_open_conversation')
      const result = await handler({ url: 'https://www.perplexity.ai/search/abc123' })
      expect(result.content[0].text).toContain('Navigated to:')
    })
  })

  describe('comet_switch_tab', () => {
    it('switches by tabId', async () => {
      mocks.listTargets.mockResolvedValue([
        { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
        { id: 'target-2', url: 'https://example.com', type: 'page', title: 'Example' },
      ])
      mocks.disconnect.mockResolvedValue(undefined)
      mocks.connect.mockResolvedValue('target-1')
      const handler = getHandler('comet_switch_tab')
      const result = await handler({ tabId: 'target-1' })

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Switched to tab')
      expect(result.content[0].text).toContain('Perplexity')
    })

    it('switches by title', async () => {
      mocks.listTargets.mockResolvedValue([
        { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
        { id: 'target-2', url: 'https://example.com', type: 'page', title: 'Example' },
      ])
      mocks.disconnect.mockResolvedValue(undefined)
      mocks.connect.mockResolvedValue('target-1')
      const handler = getHandler('comet_switch_tab')
      const result = await handler({ title: 'Perplexity' })

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Switched to tab')
    })

    it('returns tab not found for nonexistent tabId', async () => {
      mocks.listTargets.mockResolvedValue([
        { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
      ])
      const handler = getHandler('comet_switch_tab')
      const result = await handler({ tabId: 'nonexistent' })

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Tab not found')
    })

    it('returns early error when no criteria provided', async () => {
      const handler = getHandler('comet_switch_tab')
      const result = await handler({})

      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Provide at least one')
    })

    it('returns error response when connect fails', async () => {
      mocks.listTargets.mockResolvedValue([
        { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
      ])
      mocks.disconnect.mockResolvedValue(undefined)
      mocks.connect.mockRejectedValue(new Error('Connect failed'))
      const handler = getHandler('comet_switch_tab')
      const result = await handler({ tabId: 'target-1' })

      expect(result.isError).toBe(true)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('Connect failed')
    })
  })

  describe('auto-connect', () => {
    it('auto-connects when no targetId set for comet_list_tabs', async () => {
      mocks.state.targetId = null
      mocks.launchOrConnect.mockResolvedValue('target-1')
      mocks.closeExtraTabs.mockResolvedValue(undefined)
      mocks.listTabsCategorized.mockResolvedValue({
        main: [
          { id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' },
        ],
        sidecar: [],
        agentBrowsing: [],
        overlay: [],
        others: [],
      })
      const handler = getHandler('comet_list_tabs')
      const result = await handler({})
      expect(mocks.launchOrConnect).toHaveBeenCalled()
      expect(result.content[0].text).toContain('Main')
    })
  })
})
