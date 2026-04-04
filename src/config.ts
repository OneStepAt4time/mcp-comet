import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CometConfig } from './types.js'

const DEFAULTS: CometConfig = {
  port: 9222,
  timeout: 30000,
  cometPath: null,
  responseTimeout: 120000,
  logLevel: 'info',
  screenshotFormat: 'png',
  screenshotQuality: 80,
  windowWidth: 1440,
  windowHeight: 900,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 5000,
  pollInterval: 1000,
}

function env(name: string): string | undefined {
  return process.env[name]
}

/**
 * Load config from asteria.config.json in cwd if it exists.
 * Returns empty object on file-not-found or parse error.
 */
function loadConfigFile(): Partial<CometConfig> {
  try {
    const configPath = resolve(process.cwd(), 'asteria.config.json')
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Only pick keys that match CometConfig
    const result: Partial<CometConfig> = {}
    for (const key of Object.keys(DEFAULTS) as (keyof CometConfig)[]) {
      if (key in parsed && parsed[key] !== undefined) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic key access from JSON
        ;(result as any)[key] = parsed[key]
      }
    }
    return result
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    // Invalid JSON or other read error — warn and continue with defaults
    process.stderr.write(
      `[asteria:warn] Failed to load asteria.config.json: ${err instanceof Error ? err.message : err}\n`,
    )
    return {}
  }
}

export function loadConfig(overrides?: Partial<CometConfig>): CometConfig {
  const fileConfig = loadConfigFile()

  // Only include env vars that are actually set (non-undefined)
  const envConfig: Partial<CometConfig> = {}
  const portEnv = env('ASTERIA_PORT')
  if (portEnv !== undefined) envConfig.port = Number(portEnv) || DEFAULTS.port

  const timeoutEnv = env('ASTERIA_TIMEOUT')
  if (timeoutEnv !== undefined) envConfig.timeout = Number(timeoutEnv) || DEFAULTS.timeout

  const cometPathEnv = env('COMET_PATH')
  if (cometPathEnv !== undefined) envConfig.cometPath = cometPathEnv

  const responseTimeoutEnv = env('ASTERIA_RESPONSE_TIMEOUT')
  if (responseTimeoutEnv !== undefined)
    envConfig.responseTimeout = Number(responseTimeoutEnv) || DEFAULTS.responseTimeout

  const logLevelEnv = env('ASTERIA_LOG_LEVEL')
  if (logLevelEnv !== undefined) envConfig.logLevel = logLevelEnv as CometConfig['logLevel']

  const screenshotFormatEnv = env('ASTERIA_SCREENSHOT_FORMAT')
  if (screenshotFormatEnv !== undefined)
    envConfig.screenshotFormat = screenshotFormatEnv as CometConfig['screenshotFormat']

  const screenshotQualityEnv = env('ASTERIA_SCREENSHOT_QUALITY')
  if (screenshotQualityEnv !== undefined)
    envConfig.screenshotQuality = Number(screenshotQualityEnv) || DEFAULTS.screenshotQuality

  const windowWidthEnv = env('ASTERIA_WINDOW_WIDTH')
  if (windowWidthEnv !== undefined)
    envConfig.windowWidth = Number(windowWidthEnv) || DEFAULTS.windowWidth

  const windowHeightEnv = env('ASTERIA_WINDOW_HEIGHT')
  if (windowHeightEnv !== undefined)
    envConfig.windowHeight = Number(windowHeightEnv) || DEFAULTS.windowHeight

  const maxReconnectEnv = env('ASTERIA_MAX_RECONNECT')
  if (maxReconnectEnv !== undefined)
    envConfig.maxReconnectAttempts = Number(maxReconnectEnv) || DEFAULTS.maxReconnectAttempts

  const reconnectDelayEnv = env('ASTERIA_RECONNECT_DELAY')
  if (reconnectDelayEnv !== undefined)
    envConfig.maxReconnectDelay = Number(reconnectDelayEnv) || DEFAULTS.maxReconnectDelay

  const pollIntervalEnv = env('ASTERIA_POLL_INTERVAL')
  if (pollIntervalEnv !== undefined)
    envConfig.pollInterval = Number(pollIntervalEnv) || DEFAULTS.pollInterval

  return {
    ...DEFAULTS,
    ...fileConfig,
    ...envConfig,
    ...overrides,
  }
}
