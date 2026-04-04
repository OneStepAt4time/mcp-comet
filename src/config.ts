import type { CometConfig } from "./types.js";

const DEFAULTS: CometConfig = {
  port: 9222,
  timeout: 30000,
  cometPath: null,
  responseTimeout: 120000,
  logLevel: "info",
  screenshotFormat: "png",
  screenshotQuality: 80,
  windowWidth: 1440,
  windowHeight: 900,
  maxReconnectAttempts: 5,
  maxReconnectDelay: 5000,
  pollInterval: 1000,
};

function env(name: string): string | undefined {
  return process.env[name];
}

function envNum(name: string, fallback: number): number {
  const v = env(name);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

export function loadConfig(overrides?: Partial<CometConfig>): CometConfig {
  return {
    port: envNum("ASTERIA_PORT", DEFAULTS.port),
    timeout: envNum("ASTERIA_TIMEOUT", DEFAULTS.timeout),
    cometPath: env("COMET_PATH") ?? DEFAULTS.cometPath,
    responseTimeout: envNum("ASTERIA_RESPONSE_TIMEOUT", DEFAULTS.responseTimeout),
    logLevel: (env("ASTERIA_LOG_LEVEL") as CometConfig["logLevel"]) ?? DEFAULTS.logLevel,
    screenshotFormat: (env("ASTERIA_SCREENSHOT_FORMAT") as CometConfig["screenshotFormat"]) ?? DEFAULTS.screenshotFormat,
    screenshotQuality: envNum("ASTERIA_SCREENSHOT_QUALITY", DEFAULTS.screenshotQuality),
    windowWidth: envNum("ASTERIA_WINDOW_WIDTH", DEFAULTS.windowWidth),
    windowHeight: envNum("ASTERIA_WINDOW_HEIGHT", DEFAULTS.windowHeight),
    maxReconnectAttempts: envNum("ASTERIA_MAX_RECONNECT", DEFAULTS.maxReconnectAttempts),
    maxReconnectDelay: envNum("ASTERIA_RECONNECT_DELAY", DEFAULTS.maxReconnectDelay),
    pollInterval: envNum("ASTERIA_POLL_INTERVAL", DEFAULTS.pollInterval),
    ...overrides,
  };
}
