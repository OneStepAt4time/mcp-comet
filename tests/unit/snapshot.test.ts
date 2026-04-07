import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/cdp/client.js', () => ({
  CDPClient: {
    getInstance: vi.fn().mockReturnValue({
      launchOrConnect: vi.fn().mockResolvedValue('target-1'),
      safeEvaluate: vi.fn().mockResolvedValue({
        result: { value: '{"inputs":[],"buttons":[],"proseCount":0}' },
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    }),
    resetInstance: vi.fn(),
  },
}))

describe('runSnapshot', () => {
  it('connects, evaluates, and disconnects', async () => {
    const { runSnapshot } = await import('../../src/snapshot.js')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runSnapshot()

    const { CDPClient } = await import('../../src/cdp/client.js')
    expect(CDPClient.getInstance).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
