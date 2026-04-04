export function parseChromeVersion(browserString: string): number {
  const match = browserString.match(/Chrome\/(\d+)/)
  if (!match) return 0
  return parseInt(match[1], 10)
}

export function getSelectorsForVersion(_chromeMajor: number) {
  return { INPUT: ['[contenteditable="true"]'] }
}
