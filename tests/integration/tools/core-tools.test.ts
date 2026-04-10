import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvaluationError } from '../../../src/errors.js'
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

    it('sequential queries — returns new response when proseCount increases', async () => {
      // Simulates BUG-2: second query should detect new response via proseCount
      // even when old response text is still on the page
      let callCount = 0
      const oldResponse = 'This is the old response from the first query that is still on the page.'
      const newResponse = 'This is the new response from the second query with different content.'

      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        // First call: pre-send state (old response still on page, proseCount=1)
        if (callCount === 1) {
          return { result: { value: JSON.stringify({ proseCount: 1, lastProseText: oldResponse }) } }
        }
        // Second call: type prompt
        if (callCount === 2) return { result: { value: 'typed' } }
        // Third call: submit
        if (callCount === 3) return { result: { value: 'submitted' } }
        // Fourth+ calls: status polling — proseCount now 2 (new prose added)
        return {
          result: {
            value: JSON.stringify({
              status: 'completed',
              steps: ['Searching web'],
              currentStep: 'Searching web',
              response: newResponse,
              hasStopButton: false,
              proseCount: 2,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'What is 3+3?' })

      expect(result.content[0].text).toContain(newResponse)
      expect(result.content[0].text).not.toContain(oldResponse)
    })

    it('comet_ask stops polling after timeout — no runaway polling', async () => {
      let evalCalls = 0
      mocks.safeEvaluate.mockImplementation(async () => {
        evalCalls++
        if (evalCalls === 1) return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
        if (evalCalls === 2) return { result: { value: 'typed' } }
        if (evalCalls === 3) return { result: { value: 'submitted' } }
        return {
          result: {
            value: JSON.stringify({
              status: 'working',
              steps: [],
              currentStep: '',
              response: '',
              hasStopButton: true,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test', timeout: 300 })
      expect(result.content[0].text).toContain('Agent is still working')

      // Verify no runaway polling after timeout
      const callsAfterTimeout = evalCalls
      await new Promise((r) => setTimeout(r, 500))
      expect(evalCalls).toBe(callsAfterTimeout)
    })

    it('smart polling — auto-extends when response is growing', async () => {
      let callCount = 0
      const growingResponses = [
        'A'.repeat(60),
        'A'.repeat(120),
        'A'.repeat(200),
      ]
      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
        if (callCount === 2) return { result: { value: 'typed' } }
        if (callCount === 3) return { result: { value: 'submitted' } }
        const responseIdx = Math.min(callCount - 4, growingResponses.length - 1)
        return {
          result: {
            value: JSON.stringify({
              status: callCount > 6 ? 'completed' : 'working',
              steps: [],
              currentStep: '',
              response: growingResponses[responseIdx],
              hasStopButton: callCount <= 6,
              proseCount: 1,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      // 300ms timeout would normally be too short, but growing response should keep it alive
      const result = await handler({ prompt: 'test', timeout: 300 })
      // Should have gotten the full response since it was growing
      expect(result.content[0].text).toContain('A'.repeat(200))
    })

    it('smart polling — gives up after stall', async () => {
      let callCount = 0
      const stalledResponse = 'B'.repeat(60)
      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { result: { value: '{"proseCount":0,"lastProseText":""}' } }
        if (callCount === 2) return { result: { value: 'typed' } }
        if (callCount === 3) return { result: { value: 'submitted' } }
        return {
          result: {
            value: JSON.stringify({
              status: 'working',
              steps: [],
              currentStep: '',
              response: stalledResponse,
              hasStopButton: true,
              proseCount: 1,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'test', timeout: 30000 })
      // Should time out because response stopped growing (stall detection)
      expect(result.content[0].text).toContain('still working')
    })

    it('ignores old substantial response — no false positive from hasSubstantialResponse', async () => {
      // Regression: hasSubstantialResponse was OR'd into responseChanged,
      // causing old responses to be treated as new when proseCount didn't increase.
      const oldResponse = 'This is an old response from a previous query that is still on the page and is quite long.'
      let callCount = 0
      mocks.safeEvaluate.mockImplementation(async () => {
        callCount++
        // pre-send state: old response still on page
        if (callCount === 1) {
          return { result: { value: JSON.stringify({ proseCount: 1, lastProseText: oldResponse }) } }
        }
        if (callCount === 2) return { result: { value: 'typed' } }
        if (callCount === 3) return { result: { value: 'submitted' } }
        // Polling: agent hasn't started yet, old response still visible
        return {
          result: {
            value: JSON.stringify({
              status: 'working',
              steps: [],
              currentStep: '',
              response: oldResponse,
              hasStopButton: true,
              proseCount: 1,
            }),
          },
        }
      })

      const handler = getHandler('comet_ask')
      const result = await handler({ prompt: 'New question?', timeout: 1500 })

      // Should NOT return the old response as if it were the new answer
      // Instead should timeout since no new response detected
      expect(result.content[0].text).toContain('still working')
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
