import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CometConfig } from './types.js'

const DEFAULTS: CometConfig = {
  port: 9222,
  timeout: 30000,
  cometPath: null,
  responseTimeout: 180000,
  logLevel: 'info',
  screenshotFormat: 'png',
  screenshotQuality: 80,
  windowWidth: 1440,
  windowHeight: 900,
  overrideViewport: false,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 5000,
  pollInterval: 1000,
  userDataDir: null,
}

function env(name: string): string | undefined {
  return process.env[name]
}

/**
 * Load config from mcp-comet.config.json in cwd if it exists.
 * Returns empty object on file-not-found or parse error.
 */
function loadConfigFile(): Partial<CometConfig> {
  try {
    const configPath = resolve(process.cwd(), 'mcp-comet.config.json')
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
      `[mcp-comet:warn] Failed to load mcp-comet.config.json: ${err instanceof Error ? err.message : err}\n`,
    )
    return {}
  }
}

const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
const VALID_SCREENSHOT_FORMATS = ['png', 'jpeg'] as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function validatedConfig(raw: CometConfig): CometConfig {
  const safeClamp = (v: number, min: number, max: number, fallback: number) =>
    clamp(Number.isFinite(v) ? v : fallback, min, max)

  return {
    ...raw,
    port: safeClamp(raw.port, 1, 65535, DEFAULTS.port),
    timeout: safeClamp(raw.timeout, 1000, Number.POSITIVE_INFINITY, DEFAULTS.timeout),
    responseTimeout: safeClamp(
      raw.responseTimeout,
      1000,
      Number.POSITIVE_INFINITY,
      DEFAULTS.responseTimeout,
    ),
    pollInterval: safeClamp(raw.pollInterval, 100, Number.POSITIVE_INFINITY, DEFAULTS.pollInterval),
    maxReconnectAttempts: Math.max(
      0,
      Number.isFinite(raw.maxReconnectAttempts)
        ? raw.maxReconnectAttempts
        : DEFAULTS.maxReconnectAttempts,
    ),
    logLevel: VALID_LOG_LEVELS.includes(raw.logLevel as (typeof VALID_LOG_LEVELS)[number])
      ? raw.logLevel
      : DEFAULTS.logLevel,
    screenshotFormat: VALID_SCREENSHOT_FORMATS.includes(
      raw.screenshotFormat as (typeof VALID_SCREENSHOT_FORMATS)[number],
    )
      ? raw.screenshotFormat
      : DEFAULTS.screenshotFormat,
  }
}

export function loadConfig(overrides?: Partial<CometConfig>): CometConfig {
  const fileConfig = loadConfigFile()

  // Only include env vars that are actually set (non-undefined)
  const envConfig: Partial<CometConfig> = {}
  const portEnv = env('COMET_PORT')
  if (portEnv !== undefined) envConfig.port = Number(portEnv) || DEFAULTS.port

  const timeoutEnv = env('COMET_TIMEOUT')
  if (timeoutEnv !== undefined) envConfig.timeout = Number(timeoutEnv) || DEFAULTS.timeout

  const cometPathEnv = env('COMET_PATH')
  if (cometPathEnv !== undefined) envConfig.cometPath = cometPathEnv

  const responseTimeoutEnv = env('COMET_RESPONSE_TIMEOUT')
  if (responseTimeoutEnv !== undefined)
    envConfig.responseTimeout = Number(responseTimeoutEnv) || DEFAULTS.responseTimeout

  const logLevelEnv = env('COMET_LOG_LEVEL')
  if (logLevelEnv !== undefined) envConfig.logLevel = logLevelEnv as CometConfig['logLevel']

  const screenshotFormatEnv = env('COMET_SCREENSHOT_FORMAT')
  if (screenshotFormatEnv !== undefined)
    envConfig.screenshotFormat = screenshotFormatEnv as CometConfig['screenshotFormat']

  const screenshotQualityEnv = env('COMET_SCREENSHOT_QUALITY')
  if (screenshotQualityEnv !== undefined)
    envConfig.screenshotQuality = Number(screenshotQualityEnv) || DEFAULTS.screenshotQuality

  const windowWidthEnv = env('COMET_WINDOW_WIDTH')
  if (windowWidthEnv !== undefined)
    envConfig.windowWidth = Number(windowWidthEnv) || DEFAULTS.windowWidth

  const windowHeightEnv = env('COMET_WINDOW_HEIGHT')
  if (windowHeightEnv !== undefined)
    envConfig.windowHeight = Number(windowHeightEnv) || DEFAULTS.windowHeight

  const maxReconnectEnv = env('COMET_MAX_RECONNECT')
  if (maxReconnectEnv !== undefined)
    envConfig.maxReconnectAttempts = Number(maxReconnectEnv) || DEFAULTS.maxReconnectAttempts

  const reconnectDelayEnv = env('COMET_RECONNECT_DELAY')
  if (reconnectDelayEnv !== undefined)
    envConfig.maxReconnectDelay = Number(reconnectDelayEnv) || DEFAULTS.maxReconnectDelay

  const pollIntervalEnv = env('COMET_POLL_INTERVAL')
  if (pollIntervalEnv !== undefined)
    envConfig.pollInterval = Number(pollIntervalEnv) || DEFAULTS.pollInterval

  const userDataDirEnv = env('COMET_USER_DATA_DIR')
  if (userDataDirEnv !== undefined) envConfig.userDataDir = userDataDirEnv

  const overrideViewportEnv = env('COMET_OVERRIDE_VIEWPORT')
  if (overrideViewportEnv !== undefined)
    envConfig.overrideViewport = overrideViewportEnv === 'true' || overrideViewportEnv === '1'

  return validatedConfig({
    ...DEFAULTS,
    ...fileConfig,
    ...envConfig,
    ...overrides,
  })
}
