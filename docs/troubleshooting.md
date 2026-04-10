# Troubleshooting Guide

This guide covers common issues, error codes, and debugging techniques for Asteria.

## 1. Connection Issues

### "Comet not found" / `COMET_NOT_FOUND`

Asteria cannot locate the Comet executable on your system.

**Fix:** Set the `COMET_PATH` environment variable to the full path of the Comet binary.

| Platform | Default path |
|----------|-------------|
| macOS | `/Applications/Perplexity Comet.app/Contents/MacOS/comet` |
| Windows | `C:\Users\<you>\AppData\Local\Perplexity\Comet\comet.exe` |
| Linux | Set `COMET_PATH` to wherever you installed it |

**Verify:**

```bash
asteria detect
```

---

### "Debug port not reachable" / `CDP_CONNECTION_FAILED`

Comet is running but the Chrome DevTools Protocol debug port (9222) is not accessible.

**Fix:** Launch Comet with the `--remote-debugging-port` flag.

```bash
# macOS
open -a "Perplexity Comet" --args --remote-debugging-port=9222
```

**Verify:**

```bash
curl http://127.0.0.1:9222/json/version
```

This should return a JSON object with browser version information.

---

### "Connection refused"

Comet is either not running or is using a different debug port than expected.

**Fix:** Start Comet, or set `ASTERIA_PORT` to the correct port number.

**Verify:**

```bash
asteria detect
```

The output should show "active" for the debug port status.

---

## 2. Tool Issues

### "Agent is still working"

`comet_ask` returned before the agent finished processing because the timeout was reached.

**Fix:** Call `comet_wait` to poll until the agent completes, or increase the timeout.

```bash
asteria call comet_wait '{"timeout": 300000}'
```

**Alternative:** Increase the default response timeout by setting the `ASTERIA_RESPONSE_TIMEOUT` environment variable (in milliseconds).

---

### "Empty response"

The agent may not have finished processing when the response was captured.

**Fix:** Use `comet_poll` to check the current status, then `comet_wait` to retrieve the full result.

**Debug:** Use `comet_screenshot` to see the current page state and determine what Comet is displaying.

---

### "Mode switch failed: typeahead menu did not appear"

Mode switching only works on the Comet home page or a new chat page. It will fail on existing conversation pages.

**Fix:** Use `newChat: true` in your `comet_ask` call to start a fresh chat, then switch mode.

**Note:** Mode switching works by sending the "/" slash command into Comet's input field. Mode detection is icon-based (matching SVG href values), so it works regardless of the Comet UI language setting.

---

### "No sources found"

Sources are only available after a query that generates citations. Short or simple queries may not produce them.

**Fix:** Sources are returned automatically when Comet includes citations in its response. If none appear, the query may not have generated any.

**Debug:** Use `comet_screenshot` to see what Comet is currently showing.

**Note:** Collapsed citation ranges (for example `wsj+3`) are automatically expanded into individual source entries.

---

### "No stop button found"

No agent is currently running in Comet. This is expected behavior when no query is active -- it is not an error condition.

---

### "Invalid URL" / URL validation errors

`comet_open_conversation` only accepts `https://perplexity.ai/` URLs. Domain validation prevents SSRF attacks, so URLs on similar-looking domains (for example `evilperplexity.ai`) are rejected.

**Fix:** Use the full URL as returned by `comet_list_conversations`.

---

## 3. Error Codes Reference

All error subclasses inherit from `AsteriaError` (defined in `src/errors.ts`).

| Code | Class | Meaning |
|------|-------|---------|
| `CDP_CONNECTION_FAILED` | `CDPConnectionError` | Cannot connect to Chrome DevTools Protocol |
| `COMET_NOT_FOUND` | `CometNotFoundError` | Comet executable not found on system |
| `COMET_LAUNCH_FAILED` | `CometLaunchError` | Comet was found but failed to start |
| `TAB_NOT_FOUND` | `TabNotFoundError` | No tab matches the given ID or title |
| `TIMEOUT` | `TimeoutError` | Operation exceeded the configured timeout |
| `EVALUATION_FAILED` | `EvaluationError` | JavaScript evaluation failed in the browser |
| `SELECTOR_NOT_FOUND` | `SelectorError` | CSS selector did not match any element |
| `AGENT_ERROR` | `AgentError` | Agent-specific error during operation |
| `CONFIG_ERROR` | `ConfigurationError` | Invalid configuration value |

**Error response format:**

```json
{
  "content": [{ "type": "text", "text": "[CODE] message" }],
  "isError": true
}
```

Non-Asteria errors are wrapped as `Error: <message>` without a code prefix.

---

## 4. Debug Mode

Set `ASTERIA_LOG_LEVEL=debug` for verbose logging:

```bash
ASTERIA_LOG_LEVEL=debug asteria start
```

**Key log messages:**

| Message | Meaning |
|---------|---------|
| `Auto-connecting to Comet...` | Triggered by `ensureConnected()` |
| `Detected Comet Chrome/145` | Version detection succeeded |
| `Auto-connected to Comet Chrome/145` | Auto-connect from a tool call completed |
| `Type result: ...` | Prompt input evaluation result |
| `Submit result: ...` | Prompt submission result |

**Capturing CLI debug output:**

Stderr contains server logs. Redirect it to a file for inspection:

```bash
asteria call comet_ask '{"prompt": "test"}' 2>asteria.log
```

---

## 5. Health Check

Run the detect command for a quick system diagnosis:

```bash
asteria detect
```

This prints:

- Whether the Comet process is running
- The Comet executable path (or `NOT FOUND`)
- Debug port status (`active` / `not responding` / `not reachable`)
- Browser version if connected (for example `Chrome/145.2.7632.4587`)

**Quick diagnosis flow:**

1. Run `asteria detect`.
2. If the output says Comet is **not running**, start the Comet application.
3. If the executable shows **NOT FOUND**, set the `COMET_PATH` environment variable.
4. If the debug port is **not reachable**, launch Comet with `--remote-debugging-port=9222`.
5. If all checks are green, try `asteria call comet_connect` to establish a connection.
