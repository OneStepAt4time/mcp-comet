# MCP Comet UAT Test Plan

Version: 0.1.0 | Date: 2026-04-07

---

## Prerequisites

- Perplexity Comet installed and running
- MCP client configured with mcp-comet server
- Node.js >= 18
- Test environment has network access

---

## 1. Smoke Tests (~5 min)

Quick validation that core flow works.

### UAT-001: Connect to Comet

- **Tool:** `comet_connect`
- **Preconditions:** Comet is running (or not running — tool should launch it)
- **Steps:**
  1. Call `comet_connect` with no parameters
- **Expected:** Response contains "Connected to Comet" with port number (e.g., 9222) and target ID
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-002: Ask Simple Query

- **Tool:** `comet_ask`
- **Preconditions:** Comet is connected (UAT-001 passed)
- **Steps:**
  1. Call `comet_ask` with prompt: "What is 2+2?"
  2. Wait for response
- **Expected:** Response contains "4" or similar correct answer. No timeout error.
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-003: Poll Agent Status

- **Tool:** `comet_poll`
- **Preconditions:** A query has been submitted (UAT-002 or fresh)
- **Steps:**
  1. Call `comet_poll` immediately after submitting a query
- **Expected:** Response is valid JSON with fields: `status`, `steps`, `currentStep`, `response`, `hasStopButton`. Status is one of: `idle`, `working`, `completed`.
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-004: Screenshot Capture

- **Tool:** `comet_screenshot`
- **Preconditions:** Comet is connected and has a visible page
- **Steps:**
  1. Call `comet_screenshot` with no parameters (default PNG)
- **Expected:** Response contains an image (base64 data) with MIME type `image/png`. No error.
- **Actual:** ___
- **Pass/Fail:** ___

---

## 2. Functional Tests (~20 min)

Full tool-by-tool validation.

### UAT-005: comet_connect with Custom Port

- **Tool:** `comet_connect`
- **Preconditions:** Comet is running on a non-default port (e.g., 9223)
- **Steps:**
  1. Call `comet_connect` with `port: 9223`
- **Expected:** Response confirms connection on port 9223
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-006: comet_ask with New Chat

- **Tool:** `comet_ask`
- **Preconditions:** Comet is connected; a previous conversation exists
- **Steps:**
  1. Call `comet_ask` with prompt: "What is the capital of France?" and `newChat: true`
- **Expected:** Response contains "Paris". A fresh chat session is started (no prior context).
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-007: comet_ask with Custom Timeout

- **Tool:** `comet_ask`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_ask` with prompt: "Explain quantum computing in detail" and `timeout: 5000`
- **Expected:** Either a complete response within 5 seconds OR a timeout message with partial response and steps collected so far
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-008: comet_poll Returns Status Fields

- **Tool:** `comet_poll`
- **Preconditions:** Comet is connected (no active query needed)
- **Steps:**
  1. Call `comet_poll`
- **Expected:** Response is JSON object with all required fields: `status`, `steps`, `currentStep`, `response`, `hasStopButton`, `hasLoadingSpinner`
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-009: comet_stop Stops Running Agent

- **Tool:** `comet_stop`
- **Preconditions:** A long-running query is in progress (e.g., "Research the history of AI")
- **Steps:**
  1. Submit a long query via `comet_ask` (do not wait for completion)
  2. Immediately call `comet_stop`
- **Expected:** Response is "Agent stopped." or "No stop button found." depending on timing
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-010: comet_screenshot with JPEG Format

- **Tool:** `comet_screenshot`
- **Preconditions:** Comet is connected and has a visible page
- **Steps:**
  1. Call `comet_screenshot` with `format: "jpeg"`
- **Expected:** Response contains an image with MIME type `image/jpeg`. No error.
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-011: comet_mode Query Current Mode

- **Tool:** `comet_mode`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_mode` with no parameters (or `mode: null`)
- **Expected:** Response contains "Current mode: " followed by a valid mode name (e.g., "standard", "deep-research")
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-012: comet_list_tabs Categorizes Correctly

- **Tool:** `comet_list_tabs`
- **Preconditions:** Comet is connected; multiple tabs may be open
- **Steps:**
  1. Call `comet_list_tabs`
- **Expected:** Response shows tabs grouped by category (Main, Sidecar, Agent Browsing, Overlay, Other) with tab IDs and titles. Format: `=== Category (count) ===` followed by `[tabId] Title — URL`
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-013: comet_switch_tab by ID

- **Tool:** `comet_switch_tab`
- **Preconditions:** Multiple tabs are open; obtain tab ID from `comet_list_tabs`
- **Steps:**
  1. Call `comet_list_tabs` to get available tab IDs
  2. Call `comet_switch_tab` with a valid `tabId`
- **Expected:** Response contains "Switched to tab" with the new tab ID, title, and URL
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-014: comet_switch_tab by Title

- **Tool:** `comet_switch_tab`
- **Preconditions:** Multiple tabs are open with distinguishable titles
- **Steps:**
  1. Call `comet_switch_tab` with `title` containing a substring of an open tab's title
- **Expected:** Response contains "Switched to tab" with matching tab details
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-015: comet_get_sources After Query

- **Tool:** `comet_get_sources`
- **Preconditions:** A query has been completed (UAT-002 or fresh)
- **Steps:**
  1. Ensure a query with citations has completed
  2. Call `comet_get_sources`
- **Expected:** Response contains "Sources (N):" followed by numbered list of title/URL pairs, OR "No sources found" if none exist
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-016: comet_list_conversations

- **Tool:** `comet_list_conversations`
- **Preconditions:** Comet is connected; user has conversation history
- **Steps:**
  1. Navigate to perplexity.ai home if not already there
  2. Call `comet_list_conversations`
- **Expected:** Response contains "Conversations (N):" followed by numbered list of title/URL pairs, OR "No conversation links found" if none visible
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-017: comet_open_conversation Valid URL

- **Tool:** `comet_open_conversation`
- **Preconditions:** Comet is connected; a valid conversation URL is known
- **Steps:**
  1. Call `comet_open_conversation` with a valid perplexity.ai conversation URL (e.g., `https://www.perplexity.ai/search/...`)
- **Expected:** Response contains "Navigated to:" followed by the URL. Browser shows the conversation.
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-018: comet_get_page_content

- **Tool:** `comet_get_page_content`
- **Preconditions:** Comet is connected; a page with text content is visible
- **Steps:**
  1. Navigate to any page with text content
  2. Call `comet_get_page_content` with `maxLength: 500`
- **Expected:** Response contains "Title:" line followed by extracted text content, truncated to approximately 500 characters
- **Actual:** ___
- **Pass/Fail:** ___

---

## 3. Error Recovery (~10 min)

### UAT-019: Reconnect After Comet Restart

- **Tool:** `comet_connect`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Establish connection with `comet_connect`
  2. Close Comet browser completely
  3. Call `comet_connect` again
- **Expected:** Either Comet is relaunched and connected, OR an appropriate error is returned indicating Comet cannot be found/launched
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-020: Timeout Returns Partial Response

- **Tool:** `comet_ask`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_ask` with a complex research prompt: "Research the complete history of artificial intelligence from 1950 to present" and `timeout: 3000`
- **Expected:** Response contains "Agent is still working. Use comet_poll to check status." with partial steps collected and any partial response text
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-021: Invalid URL in open_conversation

- **Tool:** `comet_open_conversation`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_open_conversation` with `url: "https://google.com"`
- **Expected:** Response is an error indicating URL must be a perplexity.ai URL
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-022: Tool Call Without Prior Connect

- **Tool:** `comet_ask`
- **Preconditions:** No active connection to Comet (server just started or disconnected)
- **Steps:**
  1. Restart MCP Comet server or ensure no connection
  2. Call `comet_ask` with any prompt
- **Expected:** Response is an error indicating connection is required, OR server auto-connects and succeeds
- **Actual:** ___
- **Pass/Fail:** ___

---

## 4. Mode Switching (~5 min)

### UAT-023: Switch to Deep Research Mode

- **Tool:** `comet_mode`
- **Preconditions:** Comet is connected; currently in standard mode
- **Steps:**
  1. Call `comet_mode` with `mode: "deep-research"`
- **Expected:** Response contains "Mode switch result: success" or similar confirmation
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-024: Switch to Learn Mode

- **Tool:** `comet_mode`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_mode` with `mode: "learn"`
- **Expected:** Response contains "Mode switch result: success" or similar confirmation
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-025: Query Current Mode

- **Tool:** `comet_mode`
- **Preconditions:** Comet is connected; mode has been switched (UAT-023 or UAT-024)
- **Steps:**
  1. Call `comet_mode` with no parameters
- **Expected:** Response contains "Current mode:" followed by the mode set in previous test
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-026: Switch Back to Standard Mode

- **Tool:** `comet_mode`
- **Preconditions:** Comet is connected; currently in non-standard mode
- **Steps:**
  1. Call `comet_mode` with `mode: "standard"`
- **Expected:** Response confirms mode switch to standard
- **Actual:** ___
- **Pass/Fail:** ___

---

## 5. Cross-Session (~5 min)

### UAT-027: Multiple Queries in Sequence

- **Tools:** `comet_ask`, `comet_poll`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_ask` with prompt: "What is 1+1?"
  2. Wait for completion
  3. Call `comet_ask` with prompt: "What is 2+2?"
  4. Wait for completion
  5. Call `comet_ask` with prompt: "What is 3+3?"
- **Expected:** All three queries return correct responses (2, 4, 6). No state corruption between queries.
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-028: List Conversations After Queries

- **Tools:** `comet_ask`, `comet_list_conversations`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Execute at least one query with `comet_ask`
  2. Navigate to perplexity.ai home if needed
  3. Call `comet_list_conversations`
- **Expected:** Response includes the recently created conversation(s) in the list
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-029: Open a Conversation from History

- **Tools:** `comet_list_conversations`, `comet_open_conversation`
- **Preconditions:** Comet is connected; conversation history exists
- **Steps:**
  1. Call `comet_list_conversations` to get a conversation URL
  2. Call `comet_open_conversation` with that URL
  3. Call `comet_get_page_content` to verify content loaded
- **Expected:** Conversation opens successfully and page content shows the conversation title/content
- **Actual:** ___
- **Pass/Fail:** ___

---

## 6. Tab Management Edge Cases (~5 min)

### UAT-030: Switch to Non-Existent Tab

- **Tool:** `comet_switch_tab`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_switch_tab` with `tabId: "nonexistent-tab-id-12345"`
- **Expected:** Response contains "Tab not found matching ID" with the provided ID
- **Actual:** ___
- **Pass/Fail:** ___

---

### UAT-031: Switch Tab by Non-Matching Title

- **Tool:** `comet_switch_tab`
- **Preconditions:** Comet is connected
- **Steps:**
  1. Call `comet_switch_tab` with `title: "ZZZZZZZZZ_NONEXISTENT_TITLE"`
- **Expected:** Response contains "Tab not found matching title containing" with the provided title
- **Actual:** ___
- **Pass/Fail:** ___

---

## Summary

| Category                  | Total  | Pass | Fail |
| ------------------------- | ------ | ---- | ---- |
| Smoke                     | 4      |      |      |
| Functional                | 14     |      |      |
| Error Recovery            | 4      |      |      |
| Mode Switching            | 4      |      |      |
| Cross-Session             | 3      |      |      |
| Tab Management Edge Cases | 2      |      |      |
| **Total**                 | **31** |      |      |

---

## Test Execution Notes

- **Tester:** ___
- **Date:** ___
- **Environment:** ___
- **Comet Version:** ___
- **Node.js Version:** ___
- **Issues Found:** ___

---

## Issue Tracking

| Issue # | Test ID | Description | Severity | Status |
| ------- | ------- | ----------- | -------- | ------ |
|         |         |             |          |        |
