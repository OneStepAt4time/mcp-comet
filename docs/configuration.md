# Configuration

## Quick Reference

The three most commonly used variables:

| Variable | Purpose |
|----------|---------|
| `COMET_PATH` | Set only if Comet is not auto-detected on your system |
| `ASTERIA_RESPONSE_TIMEOUT` | Increase for long queries (default: 180000 ms / 3 min) |
| `ASTERIA_LOG_LEVEL` | Set to `debug` when troubleshooting issues |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASTERIA_PORT` | 9222 | Chrome DevTools Protocol port (1-65535) |
| `COMET_PATH` | auto-detect | Path to Comet executable |
| `ASTERIA_LOG_LEVEL` | info | Logging level: `debug`, `info`, `warn`, `error` |
| `ASTERIA_TIMEOUT` | 30000 | Comet launch timeout in ms (min 1000) |
| `ASTERIA_RESPONSE_TIMEOUT` | 180000 | Response polling timeout in ms (min 1000) |
| `ASTERIA_SCREENSHOT_FORMAT` | png | Screenshot format: `png` or `jpeg` |
| `ASTERIA_SCREENSHOT_QUALITY` | 80 | JPEG screenshot quality (0-100) |
| `ASTERIA_MAX_RECONNECT` | 5 | Max reconnection attempts (min 0) |
| `ASTERIA_RECONNECT_DELAY` | 5000 | Max reconnection backoff delay in ms |
| `ASTERIA_POLL_INTERVAL` | 1000 | Status poll interval in ms (min 100) |
| `ASTERIA_USER_DATA_DIR` | null | Path to a custom Chrome user data directory. Use this to persist cookies, local storage, and other browser profile data across sessions (for example, `~/.config/asteria/chrome-profile`). When unset, Comet uses a temporary profile each launch. |
| `ASTERIA_WINDOW_WIDTH` | 1440 | Browser window width in pixels at launch. Controls the initial viewport dimensions of the Comet browser window. |
| `ASTERIA_WINDOW_HEIGHT` | 900 | Browser window height in pixels at launch. Controls the initial viewport dimensions of the Comet browser window. |

## Priority

1. **Defaults** -- hardcoded sensible defaults
2. **Config file** -- `asteria.config.json` in current working directory
3. **Environment variables** -- `ASTERIA_*` and `COMET_PATH`
4. **Programmatic overrides** -- via `loadConfig(overrides)`

Higher priority overrides lower. Invalid values fall back to defaults.

## Config File

Create `asteria.config.json` in your project root. Keys use camelCase (not the uppercase env var names).

```jsonc
{
  // Chrome DevTools Protocol port
  "port": 9222,

  // Path to Comet executable (null = auto-detect)
  "cometPath": null,

  // Logging level: "debug" | "info" | "warn" | "error"
  "logLevel": "info",

  // Maximum time to wait for Comet to launch (ms)
  "timeout": 30000,

  // Maximum time to wait for a Comet response (ms)
  "responseTimeout": 180000,

  // Screenshot settings
  "screenshotFormat": "png",
  "screenshotQuality": 80,

  // Browser window dimensions at launch (pixels)
  "windowWidth": 1440,
  "windowHeight": 900,

  // Reconnection behavior
  "maxReconnectAttempts": 5,
  "maxReconnectDelay": 5000,

  // How often to poll for task status (ms)
  "pollInterval": 1000,

  // Custom Chrome user data directory (null = temporary profile)
  "userDataDir": null
}
```

See `asteria.config.example.json` in the repository root for a ready-to-copy template.
