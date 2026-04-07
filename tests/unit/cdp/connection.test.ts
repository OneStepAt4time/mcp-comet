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

  it('returns false for non-Error inputs: string', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError('error string')).toBe(false)
  })

  it('returns false for non-Error inputs: null', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(null)).toBe(false)
  })

  it('returns false for non-Error inputs: undefined', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(undefined)).toBe(false)
  })

  it('returns false for non-Error inputs: number', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(42)).toBe(false)
  })

  it('returns false for unrelated Error', async () => {
    const { isConnectionError } = await import('../../../src/cdp/connection.js')
    expect(isConnectionError(new Error('Some random error'))).toBe(false)
    expect(isConnectionError(new Error('SyntaxError'))).toBe(false)
    expect(isConnectionError(new Error('TypeError: foo is not a function'))).toBe(false)
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

  it('exponential delay: attempt 2 > attempt 1 > attempt 0', async () => {
    const { getBackoffDelay } = await import('../../../src/cdp/connection.js')
    const delay0 = getBackoffDelay(0, 5000)
    const delay1 = getBackoffDelay(1, 5000)
    const delay2 = getBackoffDelay(2, 5000)
    expect(delay2).toBeGreaterThan(delay1)
    expect(delay1).toBeGreaterThan(delay0)
  })

  it('caps at max delay', async () => {
    const { getBackoffDelay } = await import('../../../src/cdp/connection.js')
    const maxDelay = 3000
    // For large attempts, should cap at maxDelay
    expect(getBackoffDelay(10, maxDelay)).toBe(maxDelay)
    expect(getBackoffDelay(100, maxDelay)).toBe(maxDelay)
  })

  it('handles attempt 0', async () => {
    const { getBackoffDelay } = await import('../../../src/cdp/connection.js')
    // 1000 * 2^(0-1) = 1000 * 2^(-1) = 1000 * 0.5 = 500
    expect(getBackoffDelay(0, 5000)).toBe(500)
  })
})
