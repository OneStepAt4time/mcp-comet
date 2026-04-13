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
        {
          id: 'target-1',
          url: 'https://www.perplexity.ai/sidecar',
          type: 'page',
          title: 'Sidecar',
        },
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

    it('no stop button — returns not found message', { timeout: 10000 }, async () => {
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: 'not_found' },
      })

      const handler = getHandler('comet_stop')
      const result = await handler({})

      expect(result.content[0].text).toContain('No stop button found')
    })

    it('retries until stop button appears', async () => {
      let callCount = 0
      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        return { result: { value: callCount >= 3 ? 'stopped' : 'not_found' } }
      })

      const handler = getHandler('comet_stop')
      const result = await handler({})

      expect(result.content[0].text).toContain('Agent stopped')
      expect(callCount).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // comet_ask tests
  // ---------------------------------------------------------------------------

  describe('comet_ask', () => {
    it('returns immediate submission message without polling', async () => {
      let _callCount = 0
      mocks.safeEvaluate.mockImplementation(async () => {
        _callCount++
        return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test' })

      expect(result.content[0].text).toContain('Prompt submitted successfully')
      expect(result.content[0].text).toContain('comet_poll')
    })

    it('error handling — returns MCP error when safeEvaluate throws', async () => {
      mocks.safeEvaluate.mockRejectedValue(new Error('Script error'))
      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
    })
  })

  // ---------------------------------------------------------------------------
  // extractValue / parseAgentStatus tests
  // ---------------------------------------------------------------------------

  describe('extractValue throws EvaluationError', () => {
    it('comet_poll returns MCP error for evaluation failure with correct code', async () => {
      mocks.safeEvaluate.mockResolvedValue({
        exceptionDetails: { text: 'Script execution failed' },
        result: { description: 'TypeError: foo is not defined' },
      })

      const handler = getHandler('comet_poll')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('EVALUATION_FAILED')
      expect(result.content[0].text).toContain('Script error')
    })
  })

  describe('parseAgentStatus handles malformed JSON', () => {
    it('comet_poll returns idle status for malformed JSON string', async () => {
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: 'not-valid-json{{{}}}' },
      })

      const handler = getHandler('comet_poll')
      const result = await handler({})

      expect(result.isError).toBeUndefined()
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.status).toBe('idle')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_wait tests
  // ---------------------------------------------------------------------------

  describe('comet_wait', () => {
    it('returns response when agent completes', async () => {
      const completedStatus = {
        status: 'completed',
        steps: ['Searched', 'Analyzed'],
        currentStep: '',
        response: 'This is the full response from the agent.',
        hasStopButton: false,
      }
      mocks.safeEvaluate
        .mockResolvedValueOnce({ result: { value: JSON.stringify(completedStatus) } })
        // Settle polls
        .mockResolvedValue({ result: { value: JSON.stringify(completedStatus) } })

      const handler = getHandler('comet_wait')
      const result = await handler({ timeout: 5000 })

      expect(result.content[0].text).toContain('full response')
      expect(result.content[0].text).toContain('Searched')
    })

    it('returns timeout message when agent does not complete', async () => {
      const workingStatus = {
        status: 'working',
        steps: [],
        currentStep: 'Searching...',
        response: '',
        hasStopButton: true,
      }
      mocks.safeEvaluate.mockResolvedValue({
        result: { value: JSON.stringify(workingStatus) },
      })

      const handler = getHandler('comet_wait')
      const result = await handler({ timeout: 500 })

      expect(result.content[0].text).toContain('still working')
    })

    it('error handling — returns MCP error when safeEvaluate throws', async () => {
      mocks.safeEvaluate.mockRejectedValue(new Error('Evaluation failed'))

      const handler = getHandler('comet_wait')
      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
    })
  })
})
