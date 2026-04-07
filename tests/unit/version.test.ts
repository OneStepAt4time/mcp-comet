import { describe, expect, it, vi } from 'vitest'

describe('detectCometVersion', () => {
  it('returns default v145 selectors on fetch failure', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('no connection')) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145)
    expect(result.browser).toBe('Unknown')
    expect(result.selectors).toBeDefined()

    globalThis.fetch = originalFetch
  })

  it('parses Chrome version from Browser header', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Browser: 'Chrome/145.0.5678.90' }),
    }) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145)
    expect(result.browser).toBe('Chrome/145.0.5678.90')

    globalThis.fetch = originalFetch
  })

  it('handles non-OK HTTP response', async () => {
    const { detectCometVersion } = await import('../../src/version.js')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as any

    const result = await detectCometVersion(9222)
    expect(result.chromeMajor).toBe(145) // Falls back

    globalThis.fetch = originalFetch
  })
})
