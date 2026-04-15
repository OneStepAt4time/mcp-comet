---
description: "Use when: writing tests, modifying test files, adding test cases, reviewing test coverage. Covers Vitest conventions, harness patterns, and quality requirements for MCP Comet."
applyTo: "tests/**"
---

# Testing Conventions

## General Rules

- NEVER use `.only`, `.skip`, or `.todo` on tests — all tests must run in CI
- NEVER use `any` type assertions in tests — use proper typing or `as unknown as Type`
- Import from `vitest` explicitly: `describe`, `it`, `expect`, `vi`, `beforeEach`, `beforeAll`, `afterEach`
- Use `.js` extension in all import paths (TypeScript ESM requirement)
- Reset mocks/singletons in `beforeEach` to prevent test coupling
- Test names should describe behavior: `it('returns error when connection is refused')`

## Directory Structure

- `tests/unit/` — Isolated component tests with mocked dependencies. Mirror `src/` folder structure.
- `tests/integration/tools/` — End-to-end tool handler tests using the shared harness.
- UI script tests validate that `build*Script()` returns valid JS strings — no browser needed.

## Unit Test Patterns

- Mock external modules with `vi.mock()` at the top of the file
- CDPClient tests: mock `chrome-remote-interface` and `globalThis.fetch`
- Always call `CDPClient.resetInstance()` in `beforeEach` to clear singleton state
- Use `vi.fn()` for mock functions, assert with `toHaveBeenCalled()` / `toHaveBeenCalledWith()`

## Integration Test Harness

Always use the shared harness from `tests/integration/tools/harness.ts`:

```ts
import { getHandler, mocks, registerHandlers, resetHarness } from './harness.js'

beforeAll(async () => { await registerHandlers() })
beforeEach(() => { resetHarness() })
```

- Override `mocks.*` per-test to control CDPClient behavior
- Call `getHandler('tool_name')` to get the registered handler function
- DO NOT create alternative harness setups — extend the existing one

## Coverage Requirements

Thresholds (enforced in `vitest.config.ts`):
- Statements: 75%, Lines: 75%, Branches: 70%, Functions: 80%

When adding new source code, add corresponding tests that maintain these thresholds.

## Console Output

- Use `// biome-ignore lint/suspicious/noConsole:` with a justification when `console.*` is intentionally used in test utilities
- Prefer `vi.spyOn(console, 'error')` to assert on console output without polluting test logs
