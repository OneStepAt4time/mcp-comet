import type { CometConfig } from "./types.js";

const LEVELS = ["debug", "info", "warn", "error"] as const;

export interface Logger {
  level: string;
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

export function createLogger(level: CometConfig["logLevel"]): Logger {
  const rank = LEVELS.indexOf(level);
  return {
    level,
    debug:
      rank <= 0
        ? (...a) => console.log("[asteria:debug]", ...a)
        : () => {},
    info:
      rank <= 1
        ? (...a) => console.log("[asteria:info]", ...a)
        : () => {},
    warn:
      rank <= 2
        ? (...a) => console.warn("[asteria:warn]", ...a)
        : () => {},
    error:
      rank <= 3
        ? (...a) => console.error("[asteria:error]", ...a)
        : () => {},
  };
}
