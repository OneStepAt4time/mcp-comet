# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ASTERIA_PORT` | 9222 | Chrome DevTools Protocol port |
| `COMET_PATH` | auto-detect | Path to Comet executable |
| `ASTERIA_LOG_LEVEL` | info | Logging level |
| `ASTERIA_TIMEOUT` | 30000 | Comet launch timeout (ms) |
| `ASTERIA_RESPONSE_TIMEOUT` | 120000 | Response polling timeout (ms) |
| `ASTERIA_SCREENSHOT_FORMAT` | png | Screenshot format (png/jpeg) |
| `ASTERIA_MAX_RECONNECT` | 5 | Max reconnection attempts |
| `ASTERIA_RECONNECT_DELAY` | 5000 | Max reconnection delay (ms) |
| `ASTERIA_POLL_INTERVAL` | 1000 | Status poll interval (ms) |

## Priority

Environment variables override defaults. Programmatic overrides (via `loadConfig()`) take highest priority.
