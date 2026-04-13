# Contributing to MCP Comet

Thank you for your interest in contributing to MCP Comet. This guide covers everything you need to get started, from setting up your development environment to submitting a pull request.

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/OneStepAt4time/mcp-comet.git
cd mcp-comet
npm install
npm run build
npm test
```

MCP Comet requires Node.js 18 or later. The build step compiles TypeScript to `dist/`. Running the test suite confirms your environment is configured correctly.

## Development Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests (314 tests) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ci` | Run tests with coverage reporting |
| `npm run lint` | Lint with Biome |
| `npm run format` | Format with Biome |
| `npm run typecheck` | TypeScript type checking without emit |
| `npm run build` | Compile TypeScript to `dist/` |

Run `npm run lint` before committing to catch style issues early.

## Project Structure

```
src/
  cli.ts              -- CLI entry point (start, call, detect commands)
  server.ts           -- MCP server with 13 tool handlers
  config.ts           -- Configuration loading + validation
  errors.ts           -- 9 error subclasses with codes
  index.ts            -- Library entry point (exports startServer)
  logger.ts           -- Leveled logging (debug/info/warn/error)
  prose-filter.ts     -- Pre-send state capture for response detection
  snapshot.ts         -- DOM snapshot utility for debugging
  types.ts            -- Shared type definitions
  utils.ts            -- SSRF domain validation helper
  version.ts          -- Comet version detection
  cdp/                -- Chrome DevTools Protocol layer
    browser.ts        -- Browser detection + launching (macOS, Windows, WSL)
    client.ts         -- CDP client singleton with auto-reconnect
    connection.ts     -- WebSocket connection management
    tabs.ts           -- Tab categorization (main, sidecar, agent-browsing, overlay, other)
  ui/                 -- UI automation scripts (evaluated in browser context)
    input.ts          -- Prompt injection via execCommand('insertText')
    navigation.ts     -- Mode switch + submit + active mode detection
    status.ts         -- Agent status detection (working/idle/completed)
    extraction.ts     -- Source extraction + page content + collapsed citation expansion
    conversations.ts  -- Conversation listing from sidebar
    selectors.ts      -- Selector strategy runner
    stop.ts           -- Agent stop (click stop button)
  selectors/          -- Version-specific CSS selectors
    v145.ts           -- Chrome 145 selector set
    types.ts          -- SelectorSet interface
    index.ts          -- Version registry
tests/
  unit/               -- Unit tests (mocked CDP, test UI scripts)
    ui/               -- UI script tests
    tools/            -- Tool registry and handler tests
    cdp/              -- CDP client tests
  integration/        -- Integration tests (real tool shapes)
    tools/            -- Tool integration tests
```

## Testing Strategy

MCP Comet uses Vitest as its test runner. The suite contains 314 tests across 30+ files, organized into two categories.

**Unit tests** (`tests/unit/`) mock the CDP client and test components in isolation. This includes UI automation scripts, configuration validation, and error handling. When writing unit tests for UI scripts, verify the script output format against expected structures.

**Integration tests** (`tests/integration/`) verify that tool shapes match server definitions and test handler logic end-to-end.

**Adding tests**: Every new feature must include corresponding tests. UI scripts should have dedicated unit tests that validate the script return values. Run `npm run test:ci` to generate a coverage report and confirm your changes are adequately tested.

## Code Style

MCP Comet uses Biome for linting and formatting, configured in `biome.json` at the project root.

- TypeScript strict mode is enabled
- Single quotes, trailing commas, no semicolons
- 2-space indentation, 100 character line width
- `noExplicitAny: error` in production code (relaxed in tests)

Run `npm run lint` before every commit. If Biome reports formatting issues, run `npm run format` to fix them automatically.

## Adding Comet Versions

When a new version of Comet (or its underlying Chrome version) is released, the CSS selectors used for UI automation may change. Follow these steps to add support:

1. Run `mcp-comet detect` to confirm the Comet/Chrome version number
2. Open Comet with DevTools (Ctrl+Shift+I) and inspect the DOM elements used by the UI scripts
3. Create `src/selectors/v{version}.ts` implementing the `SelectorSet` interface
4. Copy selectors from the latest version file and update as needed
5. Register the new selector set in `src/selectors/index.ts` version map
6. Add unit tests for the new selectors
7. Test against a real Comet instance to confirm all tools work
8. Update `docs/comet-compatibility.md` with the new version

## Commit Messages

Use conventional commit prefixes so the project history is easy to navigate:

- `feat:` -- new feature or tool
- `fix:` -- bug fix
- `docs:` -- documentation changes
- `test:` -- adding or updating tests
- `refactor:` -- code restructuring without behavior change
- `chore:` -- build, CI, or tooling changes

Example: `feat: add support for Comet v147 selectors`

## PR Process

- All PRs must pass CI (Biome lint + Vitest)
- Use conventional commit prefixes in the PR title
- Include tests for new features
- Update documentation for user-facing changes
- Keep PRs focused -- one feature or fix per PR

Before opening a PR, verify locally that `npm run lint` and `npm test` both pass with no failures.

