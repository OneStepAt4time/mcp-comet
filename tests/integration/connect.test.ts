import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MockCDPServer } from './mock-cdp-server.js'

describe('Mock CDP server', () => {
  const server = new MockCDPServer({ port: 19322, browser: 'Chrome/145.1.7632.3200' })

  beforeAll(async () => {
    await server.start()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('returns version info', async () => {
    const resp = await fetch('http://127.0.0.1:19322/json/version')
    const data = await resp.json()
    expect(data.Browser).toBe('Chrome/145.1.7632.3200')
  })

  it('returns tab list', async () => {
    const resp = await fetch('http://127.0.0.1:19322/json/list')
    const data = await resp.json()
    expect(data).toHaveLength(1)
    expect(data[0].id).toBe('MOCK-TARGET-1')
  })
})
