import type { Logger } from "../logger.js";
import { CDPConnectionError } from "../errors.js";

const CONNECTION_ERROR_PATTERNS = [
  "WebSocket",
  "CLOSED",
  "not open",
  "disconnected",
  "ECONNREFUSED",
  "ECONNRESET",
  "Protocol error",
  "Target closed",
  "Session closed",
];

export function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return CONNECTION_ERROR_PATTERNS.some((p) => err.message.includes(p));
}

export function getBackoffDelay(attempt: number, maxDelay: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
}

export interface CDPConnectionState {
  connected: boolean;
  port: number;
  targetId: string | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
}
