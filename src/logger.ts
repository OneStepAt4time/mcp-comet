import type { CometConfig } from './types.js'

const LEVELS = ['debug', 'info', 'warn', 'error'] as const

export interface Logger {
  level: string
  debug: (msg: string, ...args: unknown[]) => void
  info: (msg: string, ...args: unknown[]) => void
  warn: (msg: string, ...args: unknown[]) => void
  error: (msg: string, ...args: unknown[]) => void
}

export function createLogger(level: CometConfig['logLevel']): Logger {
  const rank = LEVELS.indexOf(level)
  return {
    level,
    debug:
      rank <= 0
        ? // biome-ignore lint/suspicious/noConsole: intentional debug output to stderr
          (msg, ...args) => console.error('[asteria:debug]', msg, ...args)
        : () => {},
    info:
      rank <= 1
        ? // biome-ignore lint/suspicious/noConsole: intentional info output to stderr
          (msg, ...args) => console.error('[asteria:info]', msg, ...args)
        : () => {},
    warn:
      rank <= 2
        ? // biome-ignore lint/suspicious/noConsole: intentional warn output to stderr
          (msg, ...args) => console.warn('[asteria:warn]', msg, ...args)
        : () => {},
    error:
      rank <= 3
        ? // biome-ignore lint/suspicious/noConsole: intentional error output to stderr
          (msg, ...args) => console.error('[asteria:error]', msg, ...args)
        : () => {},
  }
}
