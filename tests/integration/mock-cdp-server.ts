import http from 'node:http'

export interface MockCDPConfig {
  port: number
  browser?: string
  tabs?: Array<{ id: string; type: string; title: string; url: string }>
}

export class MockCDPServer {
  private server: http.Server | null = null
  private config: MockCDPConfig

  constructor(config: MockCDPConfig) {
    this.config = {
      port: config.port,
      browser: config.browser ?? 'Chrome/145.1.7632.3200',
      tabs: config.tabs ?? [
        {
          id: 'MOCK-TARGET-1',
          type: 'page',
          title: 'Perplexity',
          url: 'https://www.perplexity.ai',
        },
      ],
    }
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      if (req.url === '/json/version') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ Browser: this.config.browser }))
      } else if (req.url === '/json/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(this.config.tabs))
      } else {
        res.writeHead(404)
        res.end('not found')
      }
    })
    // biome-ignore lint/style/noNonNullAssertion: server is assigned above
    await new Promise<void>((resolve) => this.server!.listen(this.config.port, resolve))
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server?.close(resolve))
  }
}
