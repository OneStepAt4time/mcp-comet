/** Agent status values produced by buildGetAgentStatusScript(). */
export type AgentStatusValue = 'idle' | 'working' | 'completed' | 'awaiting_action'

/** Canonical agent status returned by status detection scripts. */
export interface AgentStatus {
  status: AgentStatusValue
  steps: string[]
  currentStep: string
  response: string
  hasStopButton: boolean
  hasLoadingSpinner?: boolean
  proseCount?: number
  actionPrompt?: string
  actionButtons?: string[]
}

export enum TabCategory {
  Main = 'main',
  Sidecar = 'sidecar',
  AgentBrowsing = 'agentBrowsing',
  Overlay = 'overlay',
  Other = 'other',
}

export interface TabInfo {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl?: string
  category?: TabCategory
}

export interface EvaluateResult {
  result: { type: string; value?: unknown; description?: string; objectId?: string }
  exceptionDetails?: unknown
}

export interface CategorizedTabs {
  main: TabInfo[]
  sidecar: TabInfo[]
  agentBrowsing: TabInfo[]
  overlay: TabInfo[]
  others: TabInfo[]
}

export interface CometConfig {
  port: number
  timeout: number
  cometPath: string | null
  responseTimeout: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  screenshotFormat: 'png' | 'jpeg'
  screenshotQuality: number
  windowWidth: number
  windowHeight: number
  overrideViewport: boolean
  maxReconnectAttempts: number
  maxReconnectDelay: number
  pollInterval: number
  userDataDir: string | null
}
