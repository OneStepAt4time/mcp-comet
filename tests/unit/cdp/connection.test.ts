import { describe, expect, it } from 'vitest'

describe('isConnectionError', () => {
  it('matches WebSocket errors', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(new Error('WebSocket CLOSED'))).toBe(true)
    expect(isConnectionError(new Error('not open'))).toBe(true)
    expect(isConnectionError(new Error('disconnected'))).toBe(true)
    expect(isConnectionError(new Error('ECONNREFUSED'))).toBe(true)
    expect(isConnectionError(new Error('ECONNRESET'))).toBe(true)
    expect(isConnectionError(new Error('Protocol error'))).toBe(true)
    expect(isConnectionError(new Error('Target closed'))).toBe(true)
    expect(isConnectionError(new Error('Session closed'))).toBe(true)
  })

  it('does not match unrelated errors', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(new Error('Evaluation failed'))).toBe(false)
  })
})

describe('getBackoffDelay', () => {
  it('exponential with cap', async () => {
    const { getBackoffDelay } = await import('../../../src/cdp/connection.js')
    expect(getBackoffDelay(1, 5000)).toBe(1000)
    expect(getBackoffDelay(2, 5000)).toBe(2000)
    expect(getBackoffDelay(3, 5000)).toBe(4000)
    expect(getBackoffDelay(4, 5000)).toBe(5000)
    expect(getBackoffDelay(5, 5000)).toBe(5000)
  })
})
