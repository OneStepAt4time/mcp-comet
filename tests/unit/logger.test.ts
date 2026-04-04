import { describe, expect, it, vi } from 'vitest'

describe('Logger', () => {
  it('creates with default level info', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const logger = createLogger('info')
    expect(logger.level).toBe('info')
  })

  it('debug is no-op at info level', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('info')
    logger.debug('hidden')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('debug logs to stderr at debug level', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('debug')
    logger.debug('visible')
    expect(spy).toHaveBeenCalledWith('[asteria:debug]', 'visible')
    spy.mockRestore()
  })

  it('info logs to stderr at info level', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('info')
    logger.info('info msg')
    expect(spy).toHaveBeenCalledWith('[asteria:info]', 'info msg')
    spy.mockRestore()
  })

  it('warn logs at warn level', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger('warn')
    logger.warn('warning')
    expect(spy).toHaveBeenCalledWith('[asteria:warn]', 'warning')
    spy.mockRestore()
  })

  it('error always logs to stderr', async () => {
    const { createLogger } = await import('../../src/logger.js')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger('error')
    logger.error('err')
    expect(spy).toHaveBeenCalledWith('[asteria:error]', 'err')
    spy.mockRestore()
  })
})
