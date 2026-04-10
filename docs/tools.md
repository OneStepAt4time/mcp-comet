# Tool Reference

This document provides a complete reference for all 13 MCP tools exposed by the Asteria server. Each tool entry includes a description, parameter table, response format, CLI example, and implementation notes.

Tools are consumed via the Model Context Protocol (MCP) stdio transport. All tools automatically connect to or launch the Comet browser if no active session exists (see [Connection Lifecycle](#connection-lifecycle)).

---

## Table of Contents

1. [comet_connect](#1-comet_connect)
2. [comet_ask](#2-comet_ask)
3. [comet_poll](#3-comet_poll)
4. [comet_wait](#4-comet_wait)
5. [comet_stop](#5-comet_stop)
6. [comet_screenshot](#6-comet_screenshot)
7. [comet_mode](#7-comet_mode)
8. [comet_list_tabs](#8-comet_list_tabs)
9. [comet_switch_tab](#9-comet_switch_tab)
10. [comet_get_sources](#10-comet_get_sources)
11. [comet_list_conversations](#11-comet_list_conversations)
12. [comet_open_conversation](#12-comet_open_conversation)
13. [comet_get_page_content](#13-comet_get_page_content)
14. [Common Patterns](#common-patterns)
15. [Error Responses](#error-responses)
16. [Connection Lifecycle](#connection-lifecycle)

---

## 1. comet_connect

Connect to or launch the Perplexity Comet browser. Closes extra tabs and navigates to perplexity.ai.

This is the primary initialization tool. It establishes a CDP connection to Comet, detects the Chrome version, loads the matching selector set, and ensures the browser is on the main Perplexity page. Call this once at the start of a session, or let it auto-connect via `ensureConnected()` on first tool use.

### Parameters

| Parameter | Type   | Required | Default | Description                     |
|-----------|--------|----------|---------|---------------------------------|
| `port`    | number | No       | `9222`  | CDP debug port override         |

### Response

**Success:**
```
Connected to Comet on port {port} (Chrome/{version}), target {targetId}
```

**Error codes:** `CDP_CONNECTION_FAILED`, `COMET_NOT_FOUND`, `COMET_LAUNCH_FAILED`

### CLI Example

```json
{}
```

```json
{ "port": 9223 }
```

### Notes

- Auto-detects the Comet executable path if `COMET_PATH` is not set.
- Closes extra tabs (sidecar, agent-browsing) after connecting.
- Detects the Chrome major version and loads version-appropriate DOM selectors.
- If the active tab is a sidecar or non-Perplexity page, it navigates to `https://www.perplexity.ai`.
- The port defaults to the value of `ASTERIA_PORT` (default `9222`) when not provided.

---

## 2. comet_ask

Send a prompt to Perplexity Comet and poll until the agent responds or times out.

This is the primary interaction tool. It types the prompt into the Comet input field, submits it, and polls for the response using a non-blocking loop with stall detection. The response includes any agent steps and the final answer text.

### Parameters

| Parameter | Type    | Required | Default                          | Description                                      |
|-----------|---------|----------|----------------------------------|--------------------------------------------------|
| `prompt`  | string  | Yes      |                                  | The question or instruction to send              |
| `newChat` | boolean | No       | `false`                          | Start a fresh chat before sending the prompt     |
| `timeout` | number  | No       | `180000` (`ASTERIA_RESPONSE_TIMEOUT`) | Maximum wait time in ms for the agent response |

### Response

**Completed (within timeout):**
```
{response text}

Steps:
  - {step 1}
  - {step 2}
```

**Timeout (agent still working):**
```
Agent is still working. Use comet_poll to check status.

Steps so far:
  - {step 1}

Partial response:
{partial text}
```

**Error codes:** `CDP_CONNECTION_FAILED`, `EVALUATION_FAILED`, `TIMEOUT`

### CLI Example

```json
{ "prompt": "What are the latest developments in quantum computing?" }
```

```json
{
  "prompt": "Compare GPT-4 and Claude 3.5 on reasoning benchmarks",
  "newChat": true,
  "timeout": 300000
}
```

### Notes

- **Stall detection:** If the response length does not grow for 10 consecutive polls, the tool breaks out of the polling loop and returns whatever has been collected so far.
- **Response stabilization:** After the agent transitions to `idle` or `completed`, the tool performs up to 5 additional settle polls (1 second apart) to ensure the response text has finished rendering.
- **Pre-send state capture:** Before typing, the tool captures the current prose count and last prose text to accurately detect new responses versus pre-existing content.
- **newChat behavior:** When `true`, closes all extra tabs, disconnects, reconnects, and navigates to the Perplexity home page before sending the prompt.
- If `newChat` is `false` and the main tab differs from the current target, the tool automatically switches to the main tab.

---

## 3. comet_poll

Poll the current agent status, steps, and response content.

Returns a snapshot of the Comet agent state. Use this to check progress after `comet_ask` times out, or to implement custom polling logic in your own agent loop.

### Parameters

None.

### Response

**Success:**
```json
{
  "status": "working" | "idle" | "completed",
  "steps": ["step 1", "step 2"],
  "currentStep": "current step text",
  "response": "agent response text so far",
  "hasStopButton": true,
  "hasLoadingSpinner": true,
  "proseCount": 3
}
```

| Field               | Type     | Description                                                |
|---------------------|----------|------------------------------------------------------------|
| `status`            | string   | Agent status: `"working"`, `"idle"`, or `"completed"`     |
| `steps`             | string[] | List of completed step descriptions                        |
| `currentStep`       | string   | Currently executing step (may be empty)                    |
| `response`          | string   | Response text extracted so far (may be partial)            |
| `hasStopButton`     | boolean  | Whether the stop/cancel button is visible                  |
| `hasLoadingSpinner` | boolean  | Whether a loading spinner is visible                       |
| `proseCount`        | number   | Number of prose elements detected on the page              |

### CLI Example

```json
{}
```

### Notes

- This is a single-shot snapshot. It does not poll or wait.
- Use in a loop to implement custom wait logic.
- The `proseCount` field is the primary signal for detecting new response content.

---

## 4. comet_wait

Poll until the current agent finishes responding and return the full response.

Designed to be used after `comet_ask` times out. It continues polling the agent status until the response completes, another timeout is reached, or stall detection triggers.

### Parameters

| Parameter | Type   | Required | Default  | Description                          |
|-----------|--------|----------|----------|--------------------------------------|
| `timeout` | number | No       | `120000` | Maximum wait time in ms              |

### Response

**Completed (within timeout):**
```
{response text}

Steps:
  - {step 1}
  - {step 2}
```

**Timeout (agent still working):**
```
Agent is still working after timeout.

Steps so far:
  - {step 1}

Partial response:
{partial text}
```

### CLI Example

```json
{}
```

```json
{ "timeout": 300000 }
```

### Notes

- **Stall detection:** Breaks out of the polling loop if the response length does not grow for 10 consecutive polls.
- **Response stabilization:** After the agent transitions to `idle` or `completed`, performs up to 5 settle polls (1 second apart) to ensure the response has finished rendering.
- Default timeout is 120 seconds (2 minutes), shorter than `comet_ask` default of 180 seconds.
- Returns `"Agent completed with no visible response."` if the agent finishes but no response text was found.

---

## 5. comet_stop

Stop the currently running agent by clicking the stop/cancel button.

Sends a click to the Comet stop button to abort the current agent execution.

### Parameters

None.

### Response

**Success:**
```
Agent stopped.
```

**No active agent:**
```
No stop button found.
```

### CLI Example

```json
{}
```

### Notes

- Retries up to 5 times with a 1-second delay between attempts. This accounts for the possibility that the agent has not fully started when the stop request is issued.
- The stop button is only visible while the agent is actively working.

---

## 6. comet_screenshot

Take a screenshot of the current Comet browser tab.

Captures a screenshot of the active browser tab and returns it as a base64-encoded image.

### Parameters

| Parameter | Type | Required | Default (`ASTERIA_SCREENSHOT_FORMAT`) | Description                    |
|-----------|------|----------|---------------------------------------|--------------------------------|
| `format`  | enum | No       | `"png"`                               | Image format: `"png"` or `"jpeg"` |

### Response

**Success:**
```json
{
  "content": [
    {
      "type": "image",
      "data": "{base64-encoded-image-data}",
      "mimeType": "image/png"
    }
  ]
}
```

The `mimeType` is `"image/png"` for PNG format and `"image/jpeg"` for JPEG format.

### CLI Example

```json
{}
```

```json
{ "format": "jpeg" }
```

### Notes

- The default format can be overridden via the `ASTERIA_SCREENSHOT_FORMAT` environment variable.
- JPEG quality is controlled by `ASTERIA_SCREENSHOT_QUALITY` (default `80`, range 0-100).
- Returns the image as an MCP image content block, not as text.

---

## 7. comet_mode

Get or switch the current Comet mode.

Comet supports multiple interaction modes that control how queries are processed. This tool can query the current mode or switch to a different one.

### Parameters

| Parameter | Type   | Required | Default | Description                                                                                    |
|-----------|--------|----------|---------|------------------------------------------------------------------------------------------------|
| `mode`    | enum   | No       | `null`  | Mode to switch to. Omit or set to `null` to query the current mode.                           |

**Enum values for `mode`:**

| Value            | Description                     |
|------------------|---------------------------------|
| `standard`       | Default search mode             |
| `deep-research`  | Extended research mode          |
| `model-council`  | Multi-model consultation        |
| `create`         | Content creation mode           |
| `learn`          | Learning/explanation mode       |
| `review`         | Review/analysis mode            |
| `computer`       | Computer use mode               |

### Response

**Query current mode (mode omitted or null):**
```
Current mode: {mode}
```

**Switch mode:**
```
Mode switch result: {result}
```

**Switch failure:**
```
Mode switch failed: typeahead menu did not appear after retries
```

### CLI Example

Query current mode:
```json
{}
```

Switch to deep research:
```json
{ "mode": "deep-research" }
```

Switch to computer use:
```json
{ "mode": "computer" }
```

### Notes

- **Mode detection** uses typeahead menu SVG icon matching, which is locale-independent.
- **Mode switching** only works on the home page or a new chat. The tool automatically navigates to `https://www.perplexity.ai` before attempting a switch.
- The tool opens the slash-command typeahead menu by typing `/` in the input field, then selects the desired mode from the dropdown.
- Up to 10 retry attempts for mode switching in case the typeahead menu does not appear immediately.
- When querying, the tool first checks the URL for the `computer` mode indicator, then falls back to opening the typeahead menu to read the active mode.

---

## 8. comet_list_tabs

List all browser tabs categorized by role.

Returns all open browser tabs organized into functional categories based on their URL patterns and context.

### Parameters

None.

### Response

```
=== Main (2) ===
  [ABC123] Perplexity — https://www.perplexity.ai
  [DEF456] Search Results — https://www.perplexity.ai/search/...

=== Agent Browsing (1) ===
  [GHI789] Wikipedia — https://en.wikipedia.org/wiki/...

=== Other (1) ===
  [JKL012] New Tab — chrome://newtab
```

Categories:

| Category         | Description                                                      |
|------------------|------------------------------------------------------------------|
| Main             | Primary Perplexity pages (non-sidecar)                           |
| Sidecar          | Perplexity sidecar panels                                        |
| Agent Browsing   | Pages opened by the agent during research                        |
| Overlay          | Overlay or popup windows                                         |
| Other            | Tabs that do not fit any other category                          |

### CLI Example

```json
{}
```

### Notes

- Tabs are categorized by URL patterns. Perplexity URLs containing `sidecar` are classified as Sidecar.
- Returns `"No tabs found."` if no tabs are open.

---

## 9. comet_switch_tab

Switch to a different browser tab by ID or title substring.

Disconnects from the current tab and connects to the specified tab. At least one of `tabId` or `title` must be provided.

### Parameters

| Parameter | Type   | Required              | Description                                    |
|-----------|--------|-----------------------|------------------------------------------------|
| `tabId`   | string | No (at least one)     | Exact tab ID to switch to                      |
| `title`   | string | No (at least one)     | Substring of the tab title to match            |

At least one of `tabId` or `title` must be provided. If both are given, `tabId` takes precedence.

### Response

**Success:**
```
Switched to tab [{id}] {title} — {url}
```

**Not found:**
```
Tab not found matching ID "{tabId}"
```

```
Tab not found matching title containing "{title}"
```

### CLI Example

Switch by ID:
```json
{ "tabId": "ABC123DEF456" }
```

Switch by title substring:
```json
{ "title": "Wikipedia" }
```

### Notes

- Title matching uses substring containment (`title.includes(query)`), so partial matches work.
- If both `tabId` and `title` are provided, `tabId` is used.
- The tool disconnects from the current CDP target before connecting to the new one.

---

## 10. comet_get_sources

Extract and list the sources/citations from the current Comet response.

Parses the current page for citation links and returns them as a numbered list. Automatically expands collapsed citations (e.g., the `wsj+3` pattern) by clicking the expansion button and re-extracting.

### Parameters

None.

### Response

**Sources found:**
```
Sources (5):

1. Wall Street Journal Article Title
   https://www.wsj.com/articles/...

2. Reuters Report Title
   https://www.reuters.com/article/...

3. BBC News Story Title
   https://www.bbc.com/news/...
```

**No sources:**
```
No sources found on the current page.
```

### CLI Example

```json
{}
```

### Notes

- **Collapsed citation expansion:** Comet sometimes groups citations (e.g., showing `wsj+3` instead of 4 individual links). This tool detects collapsed citations (sources with empty URLs), clicks the expansion button, waits 500ms, and re-extracts.
- The merge logic deduplicates by URL to avoid listing the same source twice after expansion.
- Sources without URLs (after expansion) are listed with their title only.

---

## 11. comet_list_conversations

List recent conversation links visible on the page.

Extracts conversation links from the current page, typically from the sidebar or home page conversation list.

### Parameters

None.

### Response

**Conversations found:**
```
Conversations (3):

1. Quantum Computing Advances
   https://www.perplexity.ai/search/quantum-computing-...

2. Claude vs GPT-4 Comparison
   https://www.perplexity.ai/search/claude-vs-gpt4-...

3. Rust vs Go Performance
   https://www.perplexity.ai/search/rust-vs-go-...
```

**No conversations:**
```
No conversation links found on the current page.
```

### CLI Example

```json
{}
```

### Notes

- Only returns conversations currently visible on the page. Navigate to the home page or library first if you need a broader list.
- Conversation URLs can be used with `comet_open_conversation` to revisit a previous chat.

---

## 12. comet_open_conversation

Navigate to a specific conversation URL.

Opens a Perplexity conversation by navigating the browser to the specified URL. Includes SSRF protection to prevent navigation to non-Perplexity domains.

### Parameters

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `url`     | string | Yes      | Full URL of the conversation to open   |

### Response

**Success:**
```
Navigated to: {url}
```

**Validation failure:**
```
Error: Invalid URL: must be a https://perplexity.ai/ URL, got "{url}"
```

### CLI Example

```json
{ "url": "https://www.perplexity.ai/search/quantum-computing-advances-abc123" }
```

### Notes

- **SSRF protection:** The URL must use the `https:` protocol and the hostname must be a recognized Perplexity domain (e.g., `perplexity.ai`, `www.perplexity.ai`).
- Invalid or malformed URLs are rejected with an error before any navigation occurs.
- Use `comet_list_conversations` to discover available conversation URLs.

---

## 13. comet_get_page_content

Extract the current page content (title and body text) up to a maximum length.

Reads the page title and visible body text from the current browser tab. Useful for capturing the full content of a conversation or search result page.

### Parameters

| Parameter   | Type   | Required | Default  | Description                              |
|-------------|--------|----------|----------|------------------------------------------|
| `maxLength` | number | No       | `10000`  | Maximum characters of page text to extract |

### Response

```
Title: {page title}

{page body text up to maxLength characters}
```

### CLI Example

```json
{}
```

```json
{ "maxLength": 50000 }
```

### Notes

- The text is extracted from the page body, excluding scripts, styles, and non-visible elements.
- If the page content exceeds `maxLength`, it is truncated at that character count.
- Increase `maxLength` for long conversation pages or detailed research results.

---

## Common Patterns

### 1. Ask and Wait (Simple)

Use `comet_ask` with the default timeout (180 seconds). This handles most queries in a single call.

```json
{ "prompt": "What is the current state of fusion energy research?" }
```

### 2. Ask + Poll (Custom Loop)

Use `comet_ask` with a short timeout, then loop `comet_poll` in your agent to implement custom progress reporting or conditional logic.

```json
{ "prompt": "Deep research on AI safety", "timeout": 30000 }
```

Then poll:
```json
{}
```
(call `comet_poll` repeatedly until `status` is `"completed"` or `"idle"`)

### 3. Ask + Wait (Two-Phase)

Use `comet_ask` (which may timeout for long-running queries), then `comet_wait` to collect the full result. This is useful when you want to start a query and check back later.

Step 1:
```json
{ "prompt": "Write a comprehensive analysis of global semiconductor supply chains" }
```

Step 2 (if Step 1 times out):
```json
{ "timeout": 300000 }
```

### 4. Screenshot Verification

Use `comet_screenshot` after `comet_ask` to visually verify the response or debug layout issues.

```json
{ "prompt": "Show me the latest stock chart for NVDA" }
```

```json
{ "format": "png" }
```

### 5. Source Extraction

Use `comet_ask` to get a response, then `comet_get_sources` to extract the cited URLs for further processing.

```json
{ "prompt": "What are the best sources on transformer architecture improvements in 2024?" }
```

```json
{}
```

---

## Error Responses

All tools use a consistent error response format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "[ERROR_CODE] message"
    }
  ],
  "isError": true
}
```

### Error Codes

| Error Code              | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `CDP_CONNECTION_FAILED` | Failed to connect to Chrome DevTools Protocol                      |
| `COMET_NOT_FOUND`       | Comet browser executable not found on the system                   |
| `COMET_LAUNCH_FAILED`   | Comet browser failed to launch                                     |
| `TAB_NOT_FOUND`         | The specified browser tab was not found                            |
| `TIMEOUT`               | Operation timed out                                                |
| `EVALUATION_FAILED`     | JavaScript evaluation in the browser failed                        |
| `SELECTOR_NOT_FOUND`    | Required DOM selector not found (version mismatch possible)        |
| `AGENT_ERROR`           | General agent execution error                                      |
| `CONFIG_ERROR`          | Configuration validation error                                     |

Non-Asteria errors (e.g., unexpected exceptions) return:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: {message}"
    }
  ],
  "isError": true
}
```

---

## Connection Lifecycle

All tools call `ensureConnected()` before executing, which auto-connects if no active session exists.

### Auto-Connect Sequence

1. **Check connection state** -- if `targetId` is set, return immediately.
2. **Launch or connect** -- calls `client.launchOrConnect()` which:
   - Attempts to connect to an existing Comet instance on the configured port.
   - If no instance is found, launches Comet using the detected or configured executable path.
3. **Close extra tabs** -- calls `client.closeExtraTabs()` to clean up sidecar and agent-browsing tabs.
4. **Detect Chrome version** -- calls `detectCometVersion()` to read the Chrome major version and load the matching selector set.
5. **Navigate to main page** -- if the current target is not a Perplexity main page, navigates to `https://www.perplexity.ai`.

### Configuration

Connection behavior is controlled by these configuration values (see [Configuration](configuration.md)):

| Setting                  | Default  | Description                                  |
|--------------------------|----------|----------------------------------------------|
| `ASTERIA_PORT`           | `9222`   | CDP debug port                               |
| `COMET_PATH`             | auto     | Path to Comet executable                     |
| `ASTERIA_TIMEOUT`        | `30000`  | Comet launch timeout in ms                   |
| `ASTERIA_POLL_INTERVAL`  | `1000`   | Status poll interval in ms                   |
| `ASTERIA_MAX_RECONNECT`  | `5`      | Maximum reconnection attempts                |
| `ASTERIA_RECONNECT_DELAY`| `5000`   | Maximum reconnection backoff delay in ms     |
