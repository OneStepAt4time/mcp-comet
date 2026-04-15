/**
 * Pre-commit quality gates (Gates 1–3 from the review-qa agent).
 * Runs: build → lint + typecheck → test suite.
 * Exits with code 2 (blocking) on any failure, 0 on success.
 *
 * Invoked by the Copilot hook system (.github/hooks/pre-commit-gates.json)
 * and can also be run manually: node scripts/pre-commit-gates.mjs
 */

import { execSync } from 'node:child_process'

const gates = [
  { name: 'Gate 1: Build', cmd: 'npm run build' },
  { name: 'Gate 2a: Lint', cmd: 'npm run lint' },
  { name: 'Gate 2b: Typecheck', cmd: 'npm run typecheck' },
  { name: 'Gate 3: Tests', cmd: 'npm test' },
]

let failed = false

for (const gate of gates) {
  process.stderr.write(`\n▶ ${gate.name}...\n`)
  try {
    execSync(gate.cmd, { stdio: 'inherit', timeout: 90_000 })
    process.stderr.write(`✅ ${gate.name} passed\n`)
  } catch {
    process.stderr.write(`❌ ${gate.name} FAILED\n`)
    failed = true
    break // fail fast — don't run remaining gates
  }
}

if (failed) {
  const output = JSON.stringify({
    decision: 'block',
    stopReason: 'Pre-commit quality gates failed. Fix the issues before committing.',
  })
  process.stdout.write(output)
  process.exit(2)
}

process.stderr.write('\n✅ All pre-commit gates passed.\n')
process.exit(0)
