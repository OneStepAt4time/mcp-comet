# Configuration

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
| `ASTERIA_USER_DATA_DIR` | null | Custom Chrome user data directory |
| `ASTERIA_WINDOW_WIDTH` | 1440 | Browser window width in pixels |
| `ASTERIA_WINDOW_HEIGHT` | 900 | Browser window height in pixels |

## Priority

1. **Defaults** — hardcoded sensible defaults
2. **Config file** — `asteria.config.json` in current working directory
3. **Environment variables** — `ASTERIA_*` and `COMET_PATH`
4. **Programmatic overrides** — via `loadConfig(overrides)`

Higher priority overrides lower. Invalid values fall back to defaults.

## Config File Example

See `asteria.config.example.json` in the repository root.
