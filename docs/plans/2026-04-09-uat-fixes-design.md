# UAT Fixes Design — Sources, Conversations, Mode Switch, Auto-Connect

**Date:** 2026-04-09
**Scope:** Fix all 4 issues found during UAT testing against Comet Chrome/145.2.7632.4587

---

## Issue 1: `comet_get_sources` returns empty

### Root Cause

Sources in Comet v145 are `<span class="citation inline">` elements, not `<a>` anchors inside `[role="tabpanel"]`. Some citation spans have a parent `<a>` with href, others don't. The current `buildExtractSourcesScript` only finds anchor links inside tabpanels and misses the citation structure entirely.

### DOM Evidence

```html
<!-- Citation with link -->
<span class="citation inline">
  <a href="https://help.openai.com/en/articles/...">openai</a>
</span>

<!-- Citation without direct link -->
<span class="citation inline">openai\n+3</span>

<!-- Spacer -->
<span class="citation-nbsp"></span>
```

### Design

Add a second extraction strategy to `buildExtractSourcesScript`:

1. **Strategy A (existing):** Find `a[href]` inside `[role="tabpanel"]`, filter internal links.
2. **Strategy B (new):** Find `[class*="citation"]` elements, extract URL from closest `<a>` parent, extract title from innerText.

Merge results from both strategies, deduplicate by URL.

---

## Issue 2: `comet_list_conversations` returns empty

### Root Cause

The script filters anchors by `href` containing `/search/` or `/copilot/`. Comet v145 also uses `/computer/tasks/` for Computer mode conversations. This pattern is missing from the filter.

### DOM Evidence

Conversation links found on the page:
- `https://www.perplexity.ai/search/deep-research-test-...` (search mode)
- `https://www.perplexity.ai/computer/tasks/most-populated-cities-...` (computer mode)
- `https://www.perplexity.ai/search/what-is-the-capital-...` (search mode)

Also: conversation innerText often duplicates the title (e.g., "TitleTitle") because Comet renders both a heading and a subtitle.

### Design

1. Add `/computer/tasks/` as a third accepted URL pattern in `buildListConversationsScript`.
2. Add deduplication of the title text — if the first half of the string equals the second half, use only the first half.

---

## Issue 3: Mode switch typeahead timing

### Root Cause

After typing `/` into the input field, Comet's typeahead menu is not immediately rendered in the DOM. The current retry (5 attempts x 200ms = 1s) is insufficient. The menu may take 1-2 seconds to appear.

Additionally, the `/` character injection via `input.textContent = '/'` may not reliably trigger Comet's React event handlers on first attempt.

### Design

1. Increase retry to 10 attempts x 300ms = 3 seconds total.
2. Before each retry, re-dispatch the `/` input event to ensure Comet received the keystroke.
3. Add a small initial delay (100ms) after the first `/` before starting retries.

---

## Issue 4: Auto-connect for stateless CLI calls

### Root Cause

Each `asteria call <tool>` spawns a new process with a fresh `CDPClient` singleton. Tools like `comet_open_conversation` call `client.navigate()` which requires an active connection. Only `comet_connect` establishes the connection — other tools assume it's already done.

In persistent MCP sessions (Claude Code, Cursor), `comet_connect` is called once and the connection persists. But in CLI `call` mode, every invocation is independent.

### Design

Add an `ensureConnected()` helper in `server.ts`:

```typescript
async function ensureConnected(): Promise<void> {
  if (client.state.targetId) return  // Already connected
  await client.launchOrConnect()
  await client.closeExtraTabs()
  const { chromeMajor, selectors } = await detectCometVersion(config.port)
  activeSelectors = selectors
  logger.info(`Auto-connected to Comet Chrome/${chromeMajor}`)
}
```

Call `await ensureConnected()` at the start of every tool handler that needs a connection. This is a no-op when already connected (MCP sessions) and auto-connects when needed (CLI calls).

**Handlers that need `ensureConnected()`:** All 12 tools except `comet_connect` (which does the connection itself).

---

## Testing Strategy

Each fix follows TDD:
1. Write/update failing test first
2. Implement fix
3. Verify all tests pass
4. Manual UAT verification against real Comet

---

## Priority

1. **Issue 4 (auto-connect)** — Enables proper testing of all other tools via CLI
2. **Issue 1 (sources)** — Most visible user-facing bug
3. **Issue 2 (conversations)** — Simple selector fix
4. **Issue 3 (mode switch)** — Timing tuning, partially works already
