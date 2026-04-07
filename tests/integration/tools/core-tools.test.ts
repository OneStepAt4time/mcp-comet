import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getHandler, mocks, registerHandlers, resetHarness } from './harness.js'

describe('Core tool handlers', () => {
  beforeAll(async () => {
    await registerHandlers()
  })

  beforeEach(() => {
    resetHarness()
  })

  // ---------------------------------------------------------------------------
  // comet_connect tests
  // ---------------------------------------------------------------------------

  describe('comet_connect', () => {
    it('happy path — connects and closes extra tabs', async () => {
      const handler = getHandler('comet_connect')

      const result = await handler({})

      expect(result.content[0].text).toContain('Connected to Comet')
      expect(result.content[0].text).toContain('port 9222')
      expect(mocks.launchOrConnect).toHaveBeenCalled()
      expect(mocks.closeExtraTabs).toHaveBeenCalled()
    })

    it('error handling — returns MCP error when launchOrConnect fails', async () => {
      mocks.launchOrConnect.mockRejectedValue(new Error('Connection refused'))

      const handler = getHandler('comet_connect')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Connection refused')
    })

    it('non-main page navigation — navigates to perplexity.ai when only sidecar present', async () => {
      mocks.listTargets.mockResolvedValue([
        { id: 'target-1', url: 'https://www.perplexity.ai/sidecar', type: 'page', title: 'Sidecar' },
      ])

      const handler = getHandler('comet_connect')
      const result = await handler({})

      expect(result.content[0].text).toContain('Connected to Comet')
      expect(mocks.navigate).toHaveBeenCalledWith('https://www.perplexity.ai')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_poll tests
  // ---------------------------------------------------------------------------

  describe('comet_poll', () => {
    it('returns status JSON', async () => {
      const statusData = {
        status: 'idle',
        steps: [],
        currentStep: '',
        response: '',
        hasStopButton: false,
      }
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: JSON.stringify(statusData) },
      })

      const handler = getHandler('comet_poll')
      const result = await handler({})

      expect(result.content[0].text).toContain('idle')
      expect(result.content[0].text).toContain('"status"')
    })

    it('error handling — returns MCP error when safeEvaluate throws', async () => {
      mocks.safeEvaluate.mockRejectedValue(new Error('Evaluation failed'))

      const handler = getHandler('comet_poll')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
      expect(result.content[0].text).toContain('Evaluation failed')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_stop tests
  // ---------------------------------------------------------------------------

  describe('comet_stop', () => {
    it('stop button found — returns stopped message', async () => {
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: 'stopped' },
      })

      const handler = getHandler('comet_stop')
      const result = await handler({})

      expect(result.content[0].text).toContain('Agent stopped')
    })

    it('no stop button — returns not found message', async () => {
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: 'not_found' },
      })

      const handler = getHandler('comet_stop')
      const result = await handler({})

      expect(result.content[0].text).toContain('No stop button found')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_ask tests
  // ---------------------------------------------------------------------------

  describe('comet_ask', () => {
    it('quick response — returns agent response', async () => {
      let callCount = 0
      const responseText =
        'The answer is 42, which is the meaning of life according to Douglas Adams'

      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        // First call: pre-send state
        if (callCount === 1) {
          return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
        }
        // Second call: type prompt
        if (callCount === 2) {
          return { result: { value: 'typed' } }
        }
        // Third call: submit
        if (callCount === 3) {
          return { result: { value: 'submitted' } }
        }
        // Fourth+ calls: status polling (completed)
        return {
          result: {
            value: JSON.stringify({
              status: 'completed',
              steps: ['Searching web'],
              currentStep: 'Searching web',
              response: responseText,
              hasStopButton: false,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'What is 42?' })

      expect(result.content[0].text).toContain(responseText)
    })

    it('timeout — returns still working message', async () => {
      mocks.safeEvaluate.mockResolvedValue({
        result: {
          value: JSON.stringify({
            status: 'working',
            steps: [],
            currentStep: '',
            response: '',
            hasStopButton: true,
          }),
        },
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test', timeout: 300 })

      expect(result.content[0].text).toContain('Agent is still working')
    })

    it('error handling — returns MCP error when safeEvaluate throws', async () => {
      mocks.safeEvaluate.mockRejectedValue(new Error('Script error'))

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
    })
  })
})
