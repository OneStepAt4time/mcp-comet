import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getHandler, mocks, registerHandlers, resetHarness } from './harness.js'

describe('Data extraction tool handlers', () => {
  beforeAll(async () => {
    await registerHandlers()
  })

  beforeEach(() => {
    resetHarness()
  })

  // ---------------------------------------------------------------------------
  // comet_get_sources tests
  // ---------------------------------------------------------------------------
  describe('comet_get_sources', () => {
    it('returns formatted sources when found', async () => {
      const handler = getHandler('comet_get_sources')
      mocks.safeEvaluate.mockResolvedValue({
        result: {
          value: JSON.stringify([
            { url: 'https://example.com/article', title: 'Example Article' },
            { url: 'https://other.com/page', title: 'Other Page' },
          ]),
        },
      })

      const result = await handler({})

      expect(result.content[0].text).toContain('Sources (2)')
      expect(result.content[0].text).toContain('https://example.com/article')
      expect(result.content[0].text).toContain('https://other.com/page')
      expect(result.content[0].text).toContain('Example Article')
      expect(result.content[0].text).toContain('Other Page')
    })

    it('returns no sources message when empty', async () => {
      const handler = getHandler('comet_get_sources')
      mocks.safeEvaluate.mockResolvedValue({ result: { value: '[]' } })

      const result = await handler({})

      expect(result.content[0].text).toContain('No sources found')
    })

    it('handles errors', async () => {
      const handler = getHandler('comet_get_sources')
      mocks.safeEvaluate.mockRejectedValue(new Error('CDP error'))

      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('CDP error')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_list_conversations tests
  // ---------------------------------------------------------------------------
  describe('comet_list_conversations', () => {
    it('returns formatted conversations when found', async () => {
      const handler = getHandler('comet_list_conversations')
      mocks.safeEvaluate.mockResolvedValue({
        result: {
          value: JSON.stringify([
            { title: 'My Search', url: '/search/abc123' },
            { title: 'Another', url: '/copilot/def456' },
          ]),
        },
      })

      const result = await handler({})

      expect(result.content[0].text).toContain('Conversations (2)')
      expect(result.content[0].text).toContain('My Search')
      expect(result.content[0].text).toContain('Another')
      expect(result.content[0].text).toContain('/search/abc123')
      expect(result.content[0].text).toContain('/copilot/def456')
    })

    it('returns no conversations message when empty', async () => {
      const handler = getHandler('comet_list_conversations')
      mocks.safeEvaluate.mockResolvedValue({ result: { value: '[]' } })

      const result = await handler({})

      expect(result.content[0].text).toContain('No conversation links found')
    })

    it('handles errors', async () => {
      const handler = getHandler('comet_list_conversations')
      mocks.safeEvaluate.mockRejectedValue(new Error('CDP error'))

      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('CDP error')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_open_conversation tests
  // ---------------------------------------------------------------------------
  describe('comet_open_conversation', () => {
    it('navigates to valid URL', async () => {
      const handler = getHandler('comet_open_conversation')
      mocks.navigate.mockResolvedValue(undefined)

      const result = await handler({ url: 'https://www.perplexity.ai/search/abc123' })

      expect(result.content[0].text).toContain('Navigated to')
      expect(result.content[0].text).toContain('https://www.perplexity.ai/search/abc123')
      expect(mocks.navigate).toHaveBeenCalledWith('https://www.perplexity.ai/search/abc123')
    })

    it('rejects non-https URLs', async () => {
      const handler = getHandler('comet_open_conversation')

      const result = await handler({ url: 'http://perplexity.ai/search/abc' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('https://')
    })

    it('rejects non-perplexity.ai URLs', async () => {
      const handler = getHandler('comet_open_conversation')

      const result = await handler({ url: 'https://example.com/page' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('perplexity.ai')
    })

    it('handles navigation errors', async () => {
      const handler = getHandler('comet_open_conversation')
      mocks.navigate.mockRejectedValue(new Error('Navigation failed'))

      const result = await handler({ url: 'https://www.perplexity.ai/search/abc123' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Navigation failed')
    })
  })

  // ---------------------------------------------------------------------------
  // comet_get_page_content tests
  // ---------------------------------------------------------------------------
  describe('comet_get_page_content', () => {
    it('returns page content with default maxLength', async () => {
      const handler = getHandler('comet_get_page_content')
      mocks.safeEvaluate.mockResolvedValue({
        result: {
          value: JSON.stringify({ title: 'Test Page', text: 'This is the page content.' }),
        },
      })

      const result = await handler({})

      expect(result.content[0].text).toContain('Title: Test Page')
      expect(result.content[0].text).toContain('This is the page content.')
    })

    it('uses custom maxLength in script', async () => {
      const handler = getHandler('comet_get_page_content')
      mocks.safeEvaluate.mockResolvedValue({
        result: {
          value: JSON.stringify({ title: 'Test', text: 'Content' }),
        },
      })

      await handler({ maxLength: 5000 })

      // Get the last call to safeEvaluate (from this handler)
      const calls = mocks.safeEvaluate.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toContain('5000')
    })

    it('handles errors', async () => {
      const handler = getHandler('comet_get_page_content')
      mocks.safeEvaluate.mockRejectedValue(new Error('CDP error'))

      const result = await handler({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('CDP error')
    })

    it('handles script exceptions', async () => {
      const handler = getHandler('comet_get_page_content')
      mocks.safeEvaluate.mockResolvedValue({
        exceptionDetails: { text: 'Error' },
        result: { description: 'TypeError: something' },
      })

      const result = await handler({})

      expect(result.isError).toBe(true)
    })
  })
})
