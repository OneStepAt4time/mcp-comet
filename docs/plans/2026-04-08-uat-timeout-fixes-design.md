---
date: 2026-04-08
title: UAT Failure Fixes — smart polling, stop retry, timeout bump
status: approved
approach: All of the above
---

# UAT Failure Fixes Design

3 UAT failures from full 31-test run, all timeout/timing related.

## Fix 1: Smart polling with auto-extend

**File:** `src/server.ts` polling loop (lines 364-409)

**Problem:** Polling loop waits for hard timeout even when Perplexity is actively generating text. Responses that arrive late but correctly are discarded as "timed out."

**Fix:** Track response growth. If `lastResponse` text is getting longer across polls, reset a stall counter. Only give up after N consecutive polls with no growth (10 polls × pollInterval = 10s stall). Hard timeout remains as absolute ceiling.

**Logic:**
```
let stallCount = 0
const MAX_STALL_POLLS = 10

// In loop:
const prevLength = lastResponse.length
// ... update lastResponse ...
if (lastResponse.length > prevLength) {
  stallCount = 0  // growing, reset
} else if (sawNewResponse) {
  stallCount++    // stalled, increment
}
if (stallCount >= MAX_STALL_POLLS) break
```

## Fix 2: comet_stop retry

**File:** `src/server.ts` comet_stop handler (lines 429-443)

**Problem:** `comet_stop` checks for stop button once. If agent hasn't started yet, returns "No stop button found" immediately.

**Fix:** Retry loop — poll for stop button up to 5 times with 1s sleep between attempts. 5s total wait window.

## Fix 3: Default timeout increase

**File:** `src/config.ts` line 9

**Problem:** Default `responseTimeout` of 120s is tight for slow environments (fresh Comet profile, complex queries).

**Fix:** Increase to `180000` (3 minutes).

## Tests

- Test smart polling: mock growing response that exceeds original timeout, verify auto-extend
- Test smart polling stall: mock response that stops growing, verify stall detection
- Test stop retry: mock stop button appearing on 3rd attempt, verify success
- Test stop retry exhaustion: mock no stop button ever, verify "not found" after 5 attempts
