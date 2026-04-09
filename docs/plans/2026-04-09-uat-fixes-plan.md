# UAT Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 UAT issues: sources extraction, conversation listing, mode switch timing, and auto-connect for stateless CLI calls.

**Architecture:** 4 independent tasks in priority order. Task 1 (auto-connect) enables testing of the others via CLI. Tasks 2-4 are selector/logic fixes in the UI automation layer.

**Tech Stack:** TypeScript, Vitest, Chrome DevTools Protocol, Biome

---

### Task 1: Add `ensureConnected()` auto-connect helper [Issue 4]

**Files:**
- Modify: `src/server.ts` (add helper + add to 11 tool handlers)
- Test: `tests/integration/tools/ui-tools.test.ts` (add test)
- Reference: `tests/integration/tools/harness.ts` (mock state setup)

**Step 1: Write the failing test**

Add to `tests/integration/tools/ui-tools.test.ts`:

```typescript
describe('auto-connect', () => {
  it('auto-connects when no targetId set for comet_list_tabs', async () => {
    // Simulate fresh client with no connection
    mocks.state.targetId = null
    mocks.launchOrConnect.mockResolvedValue('target-1')
    mocks.closeExtraTabs.mockResolvedValue(undefined)
    mocks.listTabsCategorized.mockResolvedValue({
      main: [{ id: 'target-1', url: 'https://www.perplexity.ai', type: 'page', title: 'Perplexity' }],
      sidecar: [],
      agentBrowsing: [],
      overlay: [],
      others: [],
    })

    const handler = getHandler('comet_list_tabs')
    const result = await handler({})

    // Should have auto-connected
    expect(mocks.launchOrConnect).toHaveBeenCalled()
    expect(result.content[0].text).toContain('Main')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts -t "auto-connects"`
Expected: FAIL — `launchOrConnect` not called (no auto-connect logic).

**Step 3: Write minimal implementation**

In `src/server.ts`, add this helper after the `activeSelectors` declaration (around line 34):

```typescript
/** Ensure the client is connected before using tools. Auto-connects if needed. */
async function ensureConnected(): Promise<void> {
  if (client.state.targetId) return
  logger.info('Auto-connecting to Comet...')
  await client.launchOrConnect()
  await client.closeExtraTabs()
  try {
    const { chromeMajor, selectors } = await detectCometVersion(config.port)
    activeSelectors = selectors
    logger.info(`Auto-connected to Comet Chrome/${chromeMajor}`)
  } catch {
    // Version detection failure is non-fatal
  }
}
```

Then add `await ensureConnected()` at the start of each tool handler that needs a connection. The handlers that need it are all EXCEPT `comet_connect` (which does its own connection). Add `await ensureConnected()` as the first line inside each `try` block of these 11 handlers:

- `comet_ask` (line ~324)
- `comet_poll` (line ~446)
- `comet_stop` (line ~462)
- `comet_screenshot` (line ~483)
- `comet_mode` (line ~502)
- `comet_list_tabs` (line ~525)
- `comet_switch_tab` (line ~539)
- `comet_get_sources` (line ~568)
- `comet_list_conversations` (line ~592)
- `comet_open_conversation` (line ~619)
- `comet_get_page_content` (line ~647)

For each handler, add `await ensureConnected()` as the first line after `try {`. For example, `comet_poll`:

```typescript
async () => {
  try {
    await ensureConnected()
    const raw = await client.safeEvaluate(buildGetAgentStatusScript(activeSelectors))
    ...
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/tools/`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/server.ts tests/integration/tools/ui-tools.test.ts
git commit -m "feat: add ensureConnected auto-connect for stateless CLI tool calls"
```

---

### Task 2: Fix sources extraction — add citation element strategy [Issue 1]

**Files:**
- Modify: `src/ui/extraction.ts`
- Test: `tests/unit/ui/extraction.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/ui/extraction.test.ts`:

```typescript
describe('citation extraction strategy', () => {
  it('includes citation element strategy', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('citation')
  })

  it('looks for citation class elements', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('[class*="citation"]')
  })

  it('extracts URL from closest anchor parent of citation', () => {
    const s = buildExtractSourcesScript()
    expect(s).toContain('closest')
    expect(s).toContain('a')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/extraction.test.ts -t "citation"`
Expected: FAIL — no citation strategy in current code.

**Step 3: Write minimal implementation**

Replace `buildExtractSourcesScript` in `src/ui/extraction.ts`:

```typescript
export function buildExtractSourcesScript(): string {
  return `(function() {
    function isInternalLink(url) {
      if (!url) return true;
      try {
        var hostname = new URL(url).hostname;
        // Domain check must match src/utils.ts isPerplexityDomain()
        return hostname === 'perplexity.ai' || hostname.endsWith('.perplexity.ai');
      } catch (e) {
        return true;
      }
    }

    function extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return '';
      }
    }

    var sources = [];
    var seenUrls = {};

    // Strategy A: Find links inside tabpanel elements
    var tabpanels = document.querySelectorAll('[role="tabpanel"]');
    for (var t = 0; t < tabpanels.length; t++) {
      var anchors = tabpanels[t].querySelectorAll('a[href]');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var href = a.href;
        if (!href || seenUrls[href]) continue;
        if (href.indexOf('javascript:') === 0) continue;
        if (href.indexOf('#') === href.length - 1) continue;
        if (isInternalLink(href)) continue;
        seenUrls[href] = true;
        sources.push({ url: href, title: (a.innerText || '').trim() || extractDomain(href) || href });
      }
    }

    // Strategy B: Find citation elements (Comet v145 source format)
    var citations = document.querySelectorAll('[class*="citation"]');
    for (var c = 0; c < citations.length; c++) {
      var el = citations[c];
      if (el.className.indexOf('citation-nbsp') !== -1) continue;
      var anchor = el.closest('a') || el.querySelector('a');
      if (!anchor) continue;
      var href2 = anchor.href;
      if (!href2 || seenUrls[href2]) continue;
      if (isInternalLink(href2)) continue;
      seenUrls[href2] = true;
      var text2 = (el.innerText || '').trim().split('\\n')[0].trim();
      sources.push({ url: href2, title: text2 || extractDomain(href2) || href2 });
    }

    return JSON.stringify(sources);
  })()`
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/extraction.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/ui/extraction.ts tests/unit/ui/extraction.test.ts
git commit -m "fix: add citation element extraction strategy for Comet v145 sources"
```

---

### Task 3: Fix conversation listing — add `/computer/tasks/` pattern [Issue 2]

**Files:**
- Modify: `src/ui/conversations.ts`
- Test: `tests/unit/ui/conversations.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/ui/conversations.test.ts`:

```typescript
it('filters for /computer/tasks/ URLs', () => {
  const s = buildListConversationsScript()
  expect(s).toContain('/computer/tasks/')
})

it('deduplicates doubled title text', () => {
  const s = buildListConversationsScript()
  expect(s).toContain('dedupeTitle')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui/conversations.test.ts -t "computer"`
Expected: FAIL — no `/computer/tasks/` in current script.

**Step 3: Write minimal implementation**

Replace `buildListConversationsScript` in `src/ui/conversations.ts`:

```typescript
export function buildListConversationsScript(): string {
  return `(function() {
    function dedupeTitle(text) {
      if (!text) return '';
      var half = Math.floor(text.length / 2);
      if (half > 0 && text.substring(0, half) === text.substring(half)) return text.substring(0, half);
      return text;
    }

    var links = document.querySelectorAll('a[href]');
    var conversations = [];
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('/search/') !== -1 || href.indexOf('/copilot/') !== -1 || href.indexOf('/computer/tasks/') !== -1) {
        if (!seen[href]) {
          seen[href] = true;
          conversations.push({ title: dedupeTitle((links[i].innerText || '').trim()), url: href });
        }
      }
    }
    return JSON.stringify(conversations);
  })()`
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ui/conversations.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/ui/conversations.ts tests/unit/ui/conversations.test.ts
git commit -m "fix: add /computer/tasks/ pattern and title dedup to conversation listing"
```

---

### Task 4: Fix mode switch retry timing [Issue 3]

**Files:**
- Modify: `src/server.ts` (the comet_mode handler retry logic)

**Step 1: Verify current retry implementation**

The retry logic was added in a previous follow-up. Read the current `comet_mode` handler in `src/server.ts` to find the retry loop. It should look like:

```typescript
const MAX_MODE_RETRIES = 5
for (let attempt = 0; attempt < MAX_MODE_RETRIES; attempt++) {
  const raw = await client.safeEvaluate(buildModeSwitchScript(mode))
  const result = extractValue(raw)
  if (result !== 'no_listbox_found') {
    return textResult(`Mode switch result: ${result}`)
  }
  await sleep(200)
}
```

**Step 2: Update retry parameters and add re-injection**

Change the retry loop to:

```typescript
const MAX_MODE_RETRIES = 10
for (let attempt = 0; attempt < MAX_MODE_RETRIES; attempt++) {
  const raw = await client.safeEvaluate(buildModeSwitchScript(mode))
  const result = extractValue(raw)
  if (result !== 'no_listbox_found') {
    return textResult(`Mode switch result: ${result}`)
  }
  // Wait longer between retries to give Comet time to render
  await sleep(300)
}
return textResult('Mode switch failed: typeahead menu did not appear after retries')
```

Also update the integration test in `tests/integration/tools/ui-tools.test.ts`:

Find the test `'retries mode switch when listbox not immediately available'` and update `toHaveBeenCalledTimes(3)` to account for the new 10-retry max if needed (the test should still work since it resolves on the 3rd call).

**Step 3: Run tests**

Run: `npx vitest run tests/integration/tools/ui-tools.test.ts -t "mode"`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/server.ts tests/integration/tools/ui-tools.test.ts
git commit -m "fix: increase mode switch retry to 10x300ms for slower Comet rendering"
```

---

## Summary

| Task | Issue | Files | Risk |
|------|-------|-------|------|
| 1. Auto-connect | Issue 4 | server.ts, ui-tools test | MEDIUM — touches all handlers |
| 2. Sources fix | Issue 1 | extraction.ts, test | LOW — additive strategy |
| 3. Conversations fix | Issue 2 | conversations.ts, test | LOW — add pattern + dedup |
| 4. Mode switch timing | Issue 3 | server.ts, test | LOW — parameter change |
