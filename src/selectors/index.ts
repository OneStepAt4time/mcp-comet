import type { SelectorSet } from './types.js'
import { v145Selectors } from './v145.js'

const selectorMap: Map<number, SelectorSet> = new Map([[145, v145Selectors]])

export function getSelectorsForVersion(chromeMajor: number): SelectorSet {
  return selectorMap.get(chromeMajor) ?? v145Selectors
}

export function parseChromeVersion(browserString: string): number {
  const match = browserString.match(/Chrome\/(\d+)/)
  if (!match) return 0
  return parseInt(match[1], 10)
}
