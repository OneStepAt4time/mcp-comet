import type { SelectorSet } from './selectors/types.js'

export interface CometVersion {
  chromeMajor: number
  browser: string
  selectors: SelectorSet
}

export async function detectCometVersion(port: number): Promise<CometVersion> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) {
      process.stderr.write('[asteria:warn] Comet version detection: non-OK response, using default selectors\n')
      const { getSelectorsForVersion } = await import('./selectors/index.js')
      return { chromeMajor: 0, browser: 'Unknown', selectors: getSelectorsForVersion(0) }
    }
    const data = (await resp.json()) as { Browser?: string }
    const browser = data.Browser ?? 'Unknown'
    const match = browser.match(/Chrome\/(\d+)/)
    const chromeMajor = match ? parseInt(match[1], 10) : 0
    const { getSelectorsForVersion } = await import('./selectors/index.js')
    return { chromeMajor, browser, selectors: getSelectorsForVersion(chromeMajor) }
  } catch {
    process.stderr.write('[asteria:warn] Comet version detection failed, using default selectors\n')
    const { getSelectorsForVersion } = await import('./selectors/index.js')
    return { chromeMajor: 0, browser: 'Unknown', selectors: getSelectorsForVersion(0) }
  }
}
