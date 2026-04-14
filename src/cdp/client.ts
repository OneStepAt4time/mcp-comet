import CRI, { type Client } from 'chrome-remote-interface'
import { loadConfig } from '../config.js'
import { CDPConnectionError, CometLaunchError, EvaluationError } from '../errors.js'
import { createLogger, type Logger } from '../logger.js'
import type { CategorizedTabs, CometConfig, EvaluateResult, TabInfo } from '../types.js'
import { getCometPath, httpGet, killComet, startCometProcess } from './browser.js'
import { getBackoffDelay, isConnectionError } from './connection.js'
import { categorizeTabs } from './tabs.js'

export class CDPClient {
  private static instance: CDPClient
  private criClient: Client | null = null
  private logger: Logger
  private config: CometConfig

  state = {
    connected: false,
    port: 9222,
    targetId: null as string | null,
    reconnectAttempts: 0,
    isReconnecting: false,
  }

  private opLock: Promise<void> = Promise.resolve()

  private reconnectPromise: Promise<void> | null = null

  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.opLock
    let resolve!: () => void
    this.opLock = new Promise((r) => {
      resolve = r
    })
    await prev
    try {
      return await fn()
    } finally {
      resolve()
    }
  }

  private constructor(config?: CometConfig) {
    this.config = config ?? loadConfig()
    this.logger = createLogger(this.config.logLevel)
  }

  static getInstance(config?: CometConfig): CDPClient {
    if (!CDPClient.instance) CDPClient.instance = new CDPClient(config)
    return CDPClient.instance
  }

  static resetInstance(): void {
    // biome-ignore lint/style/noNonNullAssertion: intentional reset to undefined
    CDPClient.instance = undefined!
  }

  normalizePrompt(prompt: string): string {
    return prompt
      .replace(/^[-*]\s+/gm, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async httpGet(path: string): Promise<unknown> {
    const resp = await httpGet(`http://127.0.0.1:${this.state.port}${path}`)
    if (!resp.ok) throw new CDPConnectionError(`HTTP ${resp.status} for ${path}`)
    return resp.json()
  }

  async getVersion(): Promise<Record<string, string>> {
    return (await this.httpGet('/json/version')) as Promise<Record<string, string>>
  }

  async listTargets(): Promise<TabInfo[]> {
    return (await this.httpGet('/json/list')) as TabInfo[]
  }

  async connect(targetId?: string): Promise<string> {
    try {
      const version = await this.getVersion()
      this.logger.info(`Connected to Comet ${version.Browser}`)

      const targets = await this.listTargets()
      const id = targetId ?? this.pickBestTarget(targets)
      if (!id) throw new CDPConnectionError('No suitable browser target found')

      this.criClient = await CRI({ target: id, port: this.state.port })
      await this.criClient.Page.enable()
      await this.criClient.Runtime.enable()

      // Only override viewport when explicitly enabled (resizes the browser window)
      if (this.config.overrideViewport) {
        try {
          await this.criClient.Emulation.setDeviceMetricsOverride({
            width: this.config.windowWidth,
            height: this.config.windowHeight,
            deviceScaleFactor: 1,
            mobile: false,
          })
        } catch {
          this.logger.debug('Could not set viewport metrics')
        }
      }

      this.state.connected = true
      this.state.targetId = id

      this.logger.info(`Attached to target ${id}`)
      return id
    } catch (err) {
      if (err instanceof CDPConnectionError) throw err
      throw new CDPConnectionError(
        `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
        {},
        err,
      )
    }
  }

  private pickBestTarget(targets: TabInfo[]): string | null {
    // Prefer main perplexity.ai page (not sidecar)
    const mainPage = targets.find(
      (t) => t.url.includes('perplexity.ai') && !t.url.includes('sidecar') && t.type === 'page',
    )
    if (mainPage) return mainPage.id
    // Fall back to any non-chrome page
    const nonChrome = targets.find((t) => t.type === 'page' && !t.url.startsWith('chrome://'))
    if (nonChrome) return nonChrome.id
    const page = targets.find((t) => t.type === 'page')
    return page?.id ?? null
  }

  private async disconnectDirect(): Promise<void> {
    if (this.criClient) {
      try {
        await this.criClient.close()
      } catch (err) {
        this.logger.debug(
          `Disconnect error (ignored): ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      this.criClient = null
    }
    this.state.connected = false
    this.state.targetId = null
  }

  async disconnect(): Promise<void> {
    return this.enqueue(() => this.disconnectDirect())
  }

  async navigate(url: string): Promise<void> {
    return this.enqueue(async () => {
      await this.withAutoReconnect(async () => {
        if (!this.criClient) throw new CDPConnectionError('Not connected')
        await this.criClient.Page.enable()
        await this.criClient.Page.navigate({ url })
        await this.criClient.Page.loadEventFired()
      })
    })
  }

  async screenshot(format: 'png' | 'jpeg' = 'png'): Promise<string> {
    return this.enqueue(async () => {
      await this.ensureHealthyConnection()
      return await this.withAutoReconnect(async () => {
        if (!this.criClient) throw new CDPConnectionError('Not connected')
        await this.criClient.Page.enable()

        // Get actual viewport dimensions instead of assuming config values
        const clip = await this.getViewportClip()

        const { data } = await Promise.race([
          this.criClient.Page.captureScreenshot({ format, clip }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Screenshot timed out after 15s')), 15000),
          ),
        ])
        return data
      })
    })
  }

  /** Get viewport clip dimensions from the actual page layout. */
  private async getViewportClip(): Promise<{ x: number; y: number; width: number; height: number; scale: number }> {
    if (!this.criClient) return { x: 0, y: 0, width: this.config.windowWidth, height: this.config.windowHeight, scale: 1 }
    try {
      const metrics = await this.criClient.Page.getLayoutMetrics()
      // cssLayoutViewport has the actual viewport size
      const viewport = (metrics as unknown as Record<string, Record<string, number>>).cssLayoutViewport
      if (viewport && viewport.clientWidth > 0 && viewport.clientHeight > 0) {
        return { x: 0, y: 0, width: viewport.clientWidth, height: viewport.clientHeight, scale: 1 }
      }
    } catch {
      this.logger.debug('Could not get layout metrics, using config dimensions')
    }
    return { x: 0, y: 0, width: this.config.windowWidth, height: this.config.windowHeight, scale: 1 }
  }

  async evaluate(expression: string): Promise<EvaluateResult> {
    if (!this.criClient) throw new CDPConnectionError('Not connected')
    return this.criClient.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
    }) as Promise<EvaluateResult>
  }

  async safeEvaluate(expression: string): Promise<EvaluateResult> {
    return this.enqueue(async () => {
      await this.ensureHealthyConnection()
      try {
        return await this.withAutoReconnect(() => this.evaluate(expression))
      } catch (err) {
        throw new EvaluationError(
          `Evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
          { expression },
          err,
        )
      }
    })
  }

  async pressKey(key: string): Promise<void> {
    return this.enqueue(async () => {
      if (!this.criClient) throw new CDPConnectionError('Not connected')
      await this.criClient.Input.dispatchKeyEvent({ type: 'keyDown', key })
      await this.criClient.Input.dispatchKeyEvent({ type: 'keyUp', key })
    })
  }

  /** Type a character via CDP char event (inserts text into focused element). */
  async typeChar(text: string): Promise<void> {
    return this.enqueue(async () => {
      if (!this.criClient) throw new CDPConnectionError('Not connected')
      await this.criClient.Input.dispatchKeyEvent({ type: 'char', text })
    })
  }

  /** Press a key with modifier (e.g., Cmd+A for select all). modifier bit: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift. */
  async pressKeyWithModifier(key: string, modifier: number): Promise<void> {
    return this.enqueue(async () => {
      if (!this.criClient) throw new CDPConnectionError('Not connected')
      await this.criClient.Input.dispatchKeyEvent({ type: 'keyDown', key, modifiers: modifier })
      await this.criClient.Input.dispatchKeyEvent({ type: 'keyUp', key, modifiers: modifier })
    })
  }

  async isHealthy(): Promise<boolean> {
    if (!this.criClient) return false
    try {
      const result = await Promise.race([
        this.evaluate('1+1'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('health check timeout')), 10000),
        ),
      ])
      return result.result?.value === 2
    } catch (err) {
      this.logger.debug(`Health check failed: ${err instanceof Error ? err.message : String(err)}`)
      this.state.connected = false
      return false
    }
  }

  private async ensureHealthyConnection(): Promise<void> {
    if (await this.isHealthy()) return
    this.logger.warn('Connection unhealthy, reconnecting...')
    try {
      await this.reconnect()
    } catch (err) {
      this.logger.warn(
        `Reconnect failed during health check: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private async withAutoReconnect<T>(operation: () => Promise<T>): Promise<T> {
    const max = this.config.maxReconnectAttempts
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        return await operation()
      } catch (err) {
        if (!isConnectionError(err) || attempt === max) throw err
        const delay = getBackoffDelay(attempt, this.config.maxReconnectDelay)
        this.logger.warn(`Connection lost (attempt ${attempt}/${max}), retrying in ${delay}ms...`)
        await new Promise((r) => setTimeout(r, delay))
        await this.reconnect()
      }
    }
    throw new CDPConnectionError('Max reconnect attempts reached')
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectPromise) return this.reconnectPromise
    this.state.isReconnecting = true
    this.reconnectPromise = (async () => {
      try {
        await this.disconnectDirect()
        await this.connect(this.state.targetId ?? undefined)
        this.state.reconnectAttempts = 0
        this.logger.info('Reconnected')
      } catch (err) {
        this.state.reconnectAttempts++
        this.logger.error(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      } finally {
        this.state.isReconnecting = false
        this.reconnectPromise = null
      }
    })()
    return this.reconnectPromise
  }

  async listTabsCategorized(): Promise<CategorizedTabs> {
    return categorizeTabs(await this.listTargets())
  }

  async launchOrConnect(port?: number): Promise<string> {
    const p = port ?? this.config.port
    this.state.port = p

    // Try connecting to existing instance (with a retry)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.connect()
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000))
      }
    }

    // Not running — launch a new instance
    const cometPath = getCometPath()
    killComet()
    startCometProcess(cometPath, p, this.logger, this.config.userDataDir)

    // Give Comet time to start the debugging port
    await new Promise((r) => setTimeout(r, 3000))

    const start = Date.now()
    while (Date.now() - start < this.config.timeout) {
      await new Promise((r) => setTimeout(r, 1000))
      try {
        return await this.connect()
      } catch {}
    }

    throw new CometLaunchError('Comet failed to start within timeout')
  }

  async closeExtraTabs(): Promise<void> {
    return this.enqueue(async () => {
      try {
        const cat = await this.listTabsCategorized()
        // Only close agentBrowsing tabs (external pages opened by the agent).
        // Never close chrome:// tabs (crashes Comet), sidecar (internal), or our own target.
        const toClose = cat.agentBrowsing.filter((t) => t.id !== this.state.targetId)

        for (const tab of toClose) {
          try {
            if (this.criClient) await this.criClient.Target.closeTarget({ targetId: tab.id })
          } catch {
            this.logger.debug(`Target.closeTarget failed for ${tab.id}, trying HTTP fallback`)
            try {
              await httpGet(`http://127.0.0.1:${this.state.port}/json/close/${tab.id}`)
            } catch (err) {
              this.logger.debug(
                `HTTP tab close also failed for ${tab.id}: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }
        }
      } catch {
        // Non-critical — tab cleanup is best-effort
        this.logger.debug('Tab cleanup skipped (connection issue)')
      }
    })
  }
}
