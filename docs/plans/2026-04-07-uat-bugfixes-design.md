---
date: 2026-04-07
title: UAT Bug Fixes — screenshot auto-connect + stale response detection
status: approved
approach: Approach A for both bugs
---

# UAT Bug Fixes PRD

Found during UAT execution on 2026-04-07.

## BUG-1: screenshot() doesn't auto-connect

**Severity:** High — screenshot completely fails when called from a fresh process

**Symptom:** `comet_screenshot` returns `[CDP_CONNECTION_FAILED] Not connected` when called from a new `asteria call` process, while `comet_poll` and other evaluate-based tools auto-reconnect successfully.

**Root cause:** `screenshot()` (src/cdp/client.ts:134) calls `withAutoReconnect()` directly without first calling `ensureHealthyConnection()`. Compare with `safeEvaluate()` (line 165) which calls `ensureHealthyConnection()` before `withAutoReconnect()`.

**Fix:** Add `await this.ensureHealthyConnection()` as the first line of `screenshot()`, matching the pattern in `safeEvaluate()`.

**File:** `src/cdp/client.ts` — add 1 line before `return await this.withAutoReconnect(...)`

**Testing:** Add a unit test verifying screenshot calls `ensureHealthyConnection` first. Run UAT-004 again.

---

## BUG-2: comet_ask returns stale responses

**Severity:** High — cross-query contamination, returns wrong answer

**Symptom:** When a second query is submitted, `comet_ask` returns the response from the first query instead of the new one. Happens because the old response's prose text is still on the page and matches `preSendState.lastProseText`.

**Root cause:** The pre-send state capture (server.ts:337-342) records `lastProseText`. During polling (line 376), the check `status.response !== preSendState.lastProseText` is `false` when the old response is still on the page, so the code never detects a "new" response. The `hasSubstantialResponse` heuristic (>50 chars) can match the old response.

**Fix:** Use `proseCount` from pre-send state as the primary new-response signal instead of text comparison. A new response adds new prose elements, so if `proseCount` increases, a new response exists. Keep the existing text comparison as a secondary signal.

**File:** `src/server.ts` — modify the polling loop in comet_ask handler (lines 360-396)

**Logic change:**
- Capture `preSendState.proseCount` (already captured)
- During polling, also check prose count from agent status
- If prose count > preSend count, treat as new response
- Keep existing `hasSubstantialResponse` as fallback

**Testing:** Add integration test for sequential queries. Run UAT-027 again.
