---
date: 2026-04-08
title: Audit Fixes — Production Release Gate
status: approved
approach: Approach A — Surgical Fixes
---

# Audit Fixes Design

Comprehensive audit found 38 findings (6 Critical, 6 High, 11 Medium, 10 Low, 5 Info).
This design covers Critical + High only, plus test coverage backfill — the production release gate.

## Scope

- 12 code fixes (3 security, 3 resilience, 3 error handling, 3 dead code cleanup)
- 4 test coverage areas
- All changes are surgical — minimal lines touched per finding

---

## Section 1: Security (3 fixes)

### S1.1 — JS injection via prompt

**File:** `src/ui/input.ts:4-42`, `src/ui/navigation.ts:23-68`

**Problem:** `buildTypePromptScript()` escapes backslashes, quotes, newlines but misses backticks and template literals (`${...}`). `buildModeSwitchScript()` interpolates mode name without escaping.

**Fix:** Replace manual escaping with `JSON.stringify()` in both functions. This handles all edge cases (backticks, template literals, unicode line separators, etc.).

### S1.2 — SSRF via URL validation

**File:** `src/server.ts:587-604`

**Problem:** `url.includes('perplexity.ai')` allows `perplexity.ai.evil.com`, `evil.com/perplexity.ai/`, `perplexity.ai@evil.com`.

**Fix:** Use `new URL(url).hostname` check — only allow `hostname === 'perplexity.ai'` or `.endsWith('.perplexity.ai')`.

### S1.3 — Spawn error handling

**File:** `src/cdp/browser.ts:108-117`

**Problem:** Detached Comet process has no error handler. Spawn failures are silently swallowed.

**Fix:** Add `.on('error', (err) => logger.error(...))` before `unref()`.

---

## Section 2: Resilience and Concurrency (3 fixes)

### S2.1 — Operation Queue in CDPClient

**File:** `src/cdp/client.ts`

**Problem:** CDPClient singleton has no locking. Concurrent tool calls share mutable state — can corrupt connection state.

**Fix:** Add Promise-based mutex serializer:
```
private opLock: Promise<void> = Promise.resolve()

private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const prev = this.opLock
  let resolve: () => void
  this.opLock = new Promise(r => { resolve = r })
  await prev
  try { return await fn() } finally { resolve!() }
}
```
All public methods (screenshot, safeEvaluate, navigate, etc.) wrap their logic through `enqueue()`. No external dependencies.

### S2.2 — Reconnect race condition

**File:** `src/cdp/client.ts:207-238`

**Problem:** `reconnect()` returns silently if already reconnecting. Callers proceed against broken connection.

**Fix:** Track a shared `reconnectPromise`. If already reconnecting, await the existing promise instead of returning silently:
```
private reconnectPromise: Promise<void> | null = null

// In reconnect():
if (this.state.isReconnecting && this.reconnectPromise) {
  return this.reconnectPromise
}
this.reconnectPromise = (async () => { /* reconnect logic */ })()
try { await this.reconnectPromise } finally { this.reconnectPromise = null }
```

### S2.3 — Health check + error propagation

**File:** `src/cdp/client.ts:201-205`, `114-123`, `276-296`

**Problem:** `ensureHealthyConnection` doesn't catch reconnect failures. `disconnect()` and `closeExtraTabs()` silently swallow errors.

**Fix:**
- `ensureHealthyConnection`: wrap reconnect in try/catch, log warning, let caller's withAutoReconnect handle retry.
- Add `logger.debug()` in all empty catch blocks.

---

## Section 3: Error Handling and Timeout (3 fixes)

### S3.1 — Timeout cleanup in comet_ask

**File:** `src/server.ts:364-410`

**Problem:** Timeout fires but last safeEvaluate may still be pending. No cleanup of in-progress state.

**Fix:** Add `timedOut` flag checked in the while loop. On timeout exit, flag prevents further evaluations.

### S3.2 — extractValue error type

**File:** `src/server.ts:203-212`

**Problem:** `extractValue` throws generic `Error` — loses AsteriaError context.

**Fix:** Throw `EvaluationError` instead of `Error`, consistent with the error hierarchy.

### S3.3 — parseAgentStatus safety

**File:** `src/server.ts:225-228`

**Problem:** `JSON.parse` on malformed CDP response throws unhandled.

**Fix:** Wrap in try/catch, return empty status object as fallback.

---

## Section 4: Test Coverage Backfill

### S4.1 — src/cli.ts (0% → 70%+)

- Mock child_process, test runDetect() and runCall()
- JSON-RPC message construction, timeout, screenshot file write

### S4.2 — CDP client reconnection (75% → 85%+)

- Max reconnect attempts → throws
- withAutoReconnect retry on connection error
- ensureHealthyConnection calls reconnect when unhealthy
- Operation queue serializes concurrent calls

### S4.3 — Security fix tests

- Prompt with backticks, `${}`, unicode → properly escaped
- SSRF URLs → rejected
- Spawn error → logged

### S4.4 — Config env var branches (62% → 80%+)

- All ASTERIA_* env vars with valid/invalid values
- Malformed config file JSON

---

## Out of Scope (deferred post-v1.0)

- Dead code removal (unused exports)
- Magic number extraction to config
- Logging consistency cleanup
- Type safety improvements (any casts)
- buildModeSwitchScript async fix
- Medium/Low findings from all audits
