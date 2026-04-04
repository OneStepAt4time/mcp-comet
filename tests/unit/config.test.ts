import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns defaults when no config file or env vars', async () => {
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    expect(config.port).toBe(9222)
    expect(config.timeout).toBe(30000)
    expect(config.cometPath).toBeNull()
    expect(config.responseTimeout).toBe(120000)
    expect(config.logLevel).toBe('info')
    expect(config.screenshotFormat).toBe('png')
    expect(config.screenshotQuality).toBe(80)
    expect(config.windowWidth).toBe(1440)
    expect(config.windowHeight).toBe(900)
    expect(config.maxReconnectAttempts).toBe(5)
    expect(config.maxReconnectDelay).toBe(5000)
    expect(config.pollInterval).toBe(1000)
  })

  it('env vars override defaults', async () => {
    vi.stubEnv('ASTERIA_PORT', '9223')
    vi.stubEnv('ASTERIA_TIMEOUT', '60000')
    vi.stubEnv('COMET_PATH', '/custom/comet')
    vi.stubEnv('ASTERIA_LOG_LEVEL', 'debug')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    expect(config.port).toBe(9223)
    expect(config.timeout).toBe(60000)
    expect(config.cometPath).toBe('/custom/comet')
    expect(config.logLevel).toBe('debug')
  })

  it('overrides take precedence over env vars', async () => {
    vi.stubEnv('ASTERIA_PORT', '9223')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig({ port: 9224, logLevel: 'warn' })
    expect(config.port).toBe(9224)
    expect(config.logLevel).toBe('warn')
  })
})
