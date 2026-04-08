import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const configPath = resolve(process.cwd(), 'asteria.config.json')

describe('loadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    // Clean up any test config files
    if (existsSync(configPath)) {
      rmSync(configPath)
    }
  })

  it('returns defaults when no config file or env vars', async () => {
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    expect(config.port).toBe(9222)
    expect(config.timeout).toBe(30000)
    expect(config.cometPath).toBeNull()
    expect(config.responseTimeout).toBe(180000)
    expect(config.logLevel).toBe('info')
    expect(config.screenshotFormat).toBe('png')
    expect(config.screenshotQuality).toBe(80)
    expect(config.windowWidth).toBe(1440)
    expect(config.windowHeight).toBe(900)
    expect(config.maxReconnectAttempts).toBe(5)
    expect(config.maxReconnectDelay).toBe(5000)
    expect(config.pollInterval).toBe(1000)
    expect(config.userDataDir).toBeNull()
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

  it('handles malformed JSON in config file (falls back to defaults)', async () => {
    writeFileSync(configPath, '{ invalid json }', 'utf-8')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    // Should still get defaults
    expect(config.port).toBe(9222)
    expect(config.timeout).toBe(30000)
  })

  it('falls back to default for invalid env var number values', async () => {
    vi.stubEnv('ASTERIA_PORT', 'not-a-number')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    expect(config.port).toBe(9222) // Falls back to default
  })

  it('overrides parameter takes effect', async () => {
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig({ port: 9999 })
    expect(config.port).toBe(9999)
  })

  it('overrides parameter takes precedence over env vars', async () => {
    vi.stubEnv('ASTERIA_PORT', '8080')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig({ port: 9999 })
    expect(config.port).toBe(9999) // Override wins over env var
  })

  it('ignores unknown config keys in config file', async () => {
    writeFileSync(configPath, '{"port": 8080, "unknownKey": "ignored"}', 'utf-8')
    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()
    expect(config.port).toBe(8080)
    expect((config as Record<string, unknown>).unknownKey).toBeUndefined()
  })

  describe('env var branches — each ASTERIA_* env var', () => {
    const envVars = [
      { name: 'ASTERIA_PORT', key: 'port' as const, value: '9999', expected: 9999 },
      { name: 'ASTERIA_TIMEOUT', key: 'timeout' as const, value: '10000', expected: 10000 },
      { name: 'ASTERIA_RESPONSE_TIMEOUT', key: 'responseTimeout' as const, value: '60000', expected: 60000 },
      { name: 'ASTERIA_SCREENSHOT_FORMAT', key: 'screenshotFormat' as const, value: 'jpeg', expected: 'jpeg' },
      { name: 'ASTERIA_SCREENSHOT_QUALITY', key: 'screenshotQuality' as const, value: '90', expected: 90 },
      { name: 'ASTERIA_WINDOW_WIDTH', key: 'windowWidth' as const, value: '1920', expected: 1920 },
      { name: 'ASTERIA_WINDOW_HEIGHT', key: 'windowHeight' as const, value: '1080', expected: 1080 },
      { name: 'ASTERIA_MAX_RECONNECT', key: 'maxReconnectAttempts' as const, value: '10', expected: 10 },
      { name: 'ASTERIA_RECONNECT_DELAY', key: 'maxReconnectDelay' as const, value: '10000', expected: 10000 },
      { name: 'ASTERIA_POLL_INTERVAL', key: 'pollInterval' as const, value: '500', expected: 500 },
      { name: 'ASTERIA_USER_DATA_DIR', key: 'userDataDir' as const, value: '/tmp/comet-profile', expected: '/tmp/comet-profile' },
    ]

    for (const { name, key, value, expected } of envVars) {
      it(`reads ${name} from environment`, async () => {
        vi.stubEnv(name, value)
        const { loadConfig } = await import('../../src/config.js')
        const config = loadConfig()
        expect(config[key]).toBe(expected)
      })
    }

    it('falls back to default for invalid number env var', async () => {
      vi.stubEnv('ASTERIA_PORT', 'not-a-number')
      const { loadConfig } = await import('../../src/config.js')
      const config = loadConfig()
      expect(config.port).toBe(9222)
    })
  })
})
