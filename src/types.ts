export enum AgentState {
  Idle = "idle",
  Thinking = "thinking",
  Searching = "searching",
  Responding = "responding",
  Completed = "completed",
  Error = "error",
}

export enum TabCategory {
  Main = "main",
  Sidecar = "sidecar",
  AgentBrowsing = "agentBrowsing",
  Overlay = "overlay",
  Other = "other",
}

export interface TabInfo {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
  category?: TabCategory;
}

export interface AgentStatus {
  state: AgentState;
  steps: string[];
  currentStep: string;
  response: string;
  hasStopButton: boolean;
  agentBrowsingUrl: string;
}

export interface EvaluateResult {
  result: { type: string; value?: unknown; description?: string; objectId?: string };
  exceptionDetails?: unknown;
}

export interface CategorizedTabs {
  main: TabInfo[];
  sidecar: TabInfo[];
  agentBrowsing: TabInfo[];
  overlay: TabInfo[];
  others: TabInfo[];
}

export interface CometConfig {
  port: number;
  timeout: number;
  cometPath: string | null;
  responseTimeout: number;
  logLevel: "debug" | "info" | "warn" | "error";
  screenshotFormat: "png" | "jpeg";
  screenshotQuality: number;
  windowWidth: number;
  windowHeight: number;
  maxReconnectAttempts: number;
  maxReconnectDelay: number;
  pollInterval: number;
}
