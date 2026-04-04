import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('getCometPath', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns COMET_PATH env var when set', async () => {
    vi.stubEnv('COMET_PATH', '/custom/path/comet.exe')
    const { getCometPath } = await import('../../../src/cdp/browser.js')
    expect(getCometPath()).toBe('/custom/path/comet.exe')
  })

  it('throws CometNotFoundError when not found', async () => {
    // Delete COMET_PATH entirely so the function falls through to platform search
    delete process.env.COMET_PATH
    // Stub all known candidate paths to be empty so the platform search fails
    vi.stubEnv('LOCALAPPDATA', '')
    vi.stubEnv('PROGRAMFILES', '')
    vi.stubEnv('PROGRAMFILES(X86)', '')
    const { getCometPath } = await import('../../../src/cdp/browser.js')
    expect(() => getCometPath()).toThrow()
  })
})

describe('isWindows', () => {
  it('returns true on win32', async () => {
    const orig = process.platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    })
    const { isWindows, isMac } = await import('../../../src/cdp/browser.js')
    expect(isWindows()).toBe(true)
    expect(isMac()).toBe(false)
    Object.defineProperty(process, 'platform', {
      value: orig,
      configurable: true,
    })
  })
})
