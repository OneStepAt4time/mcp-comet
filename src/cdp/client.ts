import CRI, { type Client } from "chrome-remote-interface";
import type { TabInfo, CategorizedTabs, EvaluateResult, CometConfig } from "../types.js";
import { createLogger, type Logger } from "../logger.js";
import { loadConfig } from "../config.js";
import { categorizeTabs } from "./tabs.js";
import { isConnectionError, getBackoffDelay } from "./connection.js";
import {
  isWindows,
  windowsFetch,
  getCometPath,
  isCometProcessRunning,
  killComet,
  startCometProcess,
} from "./browser.js";
import {
  CDPConnectionError,
  CometLaunchError,
  EvaluationError,
} from "../errors.js";

export class CDPClient {
  private static instance: CDPClient;
  private criClient: Client | null = null;
  private logger: Logger;
  private config: CometConfig;

  state = {
    connected: false,
    port: 9222,
    targetId: null as string | null,
    reconnectAttempts: 0,
    isReconnecting: false,
  };

  private constructor(config?: CometConfig) {
    this.config = config ?? loadConfig();
    this.logger = createLogger(this.config.logLevel);
  }

  static getInstance(config?: CometConfig): CDPClient {
    if (!CDPClient.instance) CDPClient.instance = new CDPClient(config);
    return CDPClient.instance;
  }

  static resetInstance(): void {
    CDPClient.instance = undefined!;
  }

  normalizePrompt(prompt: string): string {
    return prompt
      .replace(/^[-*]\s+/gm, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async httpGet(path: string): Promise<unknown> {
    if (isWindows()) {
      const resp = await windowsFetch(
        `http://127.0.0.1:${this.state.port}${path}`,
      );
      if (!resp.ok)
        throw new CDPConnectionError(`HTTP ${resp.status} for ${path}`);
      return resp.json();
    }
    const resp = await fetch(
      `http://127.0.0.1:${this.state.port}${path}`,
    );
    if (!resp.ok)
      throw new CDPConnectionError(`HTTP ${resp.status} for ${path}`);
    return resp.json();
  }

  async getVersion(): Promise<Record<string, string>> {
    return (await this.httpGet("/json/version")) as Promise<Record<string, string>>;
  }

  async listTargets(): Promise<TabInfo[]> {
    return (await this.httpGet("/json/list")) as TabInfo[];
  }

  async connect(targetId?: string): Promise<string> {
    try {
      const version = await this.getVersion();
      this.logger.info(`Connected to Comet ${version["Browser"]}`);

      const targets = await this.listTargets();
      const id = targetId ?? this.pickBestTarget(targets);
      if (!id) throw new CDPConnectionError("No suitable browser target found");

      this.criClient = await CRI({ target: id, port: this.state.port });
      await this.criClient.Page.enable();
      await this.criClient.Runtime.enable();
      await this.criClient.DOM.enable();

      this.state.connected = true;
      this.state.targetId = id;

      try {
        await this.criClient.Emulation.setDeviceMetricsOverride({
          width: this.config.windowWidth,
          height: this.config.windowHeight,
          deviceScaleFactor: 1,
          mobile: false,
        });
      } catch {}

      this.logger.info(`Attached to target ${id}`);
      return id;
    } catch (err) {
      if (err instanceof CDPConnectionError) throw err;
      throw new CDPConnectionError(
        `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
        {},
        err,
      );
    }
  }

  private pickBestTarget(targets: TabInfo[]): string | null {
    const pp = targets.find(
      (t) => t.url.includes("perplexity.ai") && t.type === "page",
    );
    if (pp) return pp.id;
    const page = targets.find((t) => t.type === "page");
    return page?.id ?? null;
  }

  async disconnect(): Promise<void> {
    if (this.criClient) {
      try {
        await this.criClient.close();
      } catch {}
      this.criClient = null;
    }
    this.state.connected = false;
    this.state.targetId = null;
  }

  async navigate(url: string): Promise<void> {
    if (!this.criClient) throw new CDPConnectionError("Not connected");
    await this.criClient.Page.navigate({ url });
    await this.criClient.Page.loadEventFired();
  }

  async screenshot(format: "png" | "jpeg" = "png"): Promise<string> {
    if (!this.criClient) throw new CDPConnectionError("Not connected");
    const { data } = await this.criClient.Page.captureScreenshot({ format });
    return data;
  }

  async evaluate(expression: string): Promise<EvaluateResult> {
    if (!this.criClient) throw new CDPConnectionError("Not connected");
    return this.criClient.Runtime.evaluate({
      expression,
      awaitPromise: true,
      returnByValue: true,
    }) as Promise<EvaluateResult>;
  }

  async safeEvaluate(expression: string): Promise<EvaluateResult> {
    await this.ensureHealthyConnection();
    try {
      return await this.withAutoReconnect(() => this.evaluate(expression));
    } catch (err) {
      throw new EvaluationError(
        `Evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        { expression },
        err,
      );
    }
  }

  async pressKey(key: string): Promise<void> {
    if (!this.criClient) throw new CDPConnectionError("Not connected");
    await this.criClient.Input.dispatchKeyEvent({ type: "keyDown", key });
    await this.criClient.Input.dispatchKeyEvent({ type: "keyUp", key });
  }

  async isHealthy(): Promise<boolean> {
    if (!this.criClient) return false;
    try {
      const result = await Promise.race([
        this.evaluate("1+1"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("health check timeout")), 3000),
        ),
      ]);
      return result.result?.value === 2;
    } catch {
      this.state.connected = false;
      return false;
    }
  }

  private async ensureHealthyConnection(): Promise<void> {
    if (await this.isHealthy()) return;
    this.logger.warn("Connection unhealthy, reconnecting...");
    await this.reconnect();
  }

  private async withAutoReconnect<T>(operation: () => Promise<T>): Promise<T> {
    const max = this.config.maxReconnectAttempts;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        return await operation();
      } catch (err) {
        if (!isConnectionError(err) || attempt === max) throw err;
        const delay = getBackoffDelay(attempt, this.config.maxReconnectDelay);
        this.logger.warn(
          `Connection lost (attempt ${attempt}/${max}), retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        await this.reconnect();
      }
    }
    throw new CDPConnectionError("Max reconnect attempts reached");
  }

  private async reconnect(): Promise<void> {
    if (this.state.isReconnecting) return;
    this.state.isReconnecting = true;
    try {
      await this.disconnect();
      await this.connect(this.state.targetId ?? undefined);
      this.state.reconnectAttempts = 0;
      this.logger.info("Reconnected");
    } catch (err) {
      this.state.reconnectAttempts++;
      this.logger.error(
        `Reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      this.state.isReconnecting = false;
    }
  }

  async listTabsCategorized(): Promise<CategorizedTabs> {
    return categorizeTabs(await this.listTargets());
  }

  async launchOrConnect(port?: number): Promise<string> {
    const p = port ?? this.config.port;
    this.state.port = p;

    try {
      return await this.connect();
    } catch {}

    const cometPath = getCometPath();
    killComet();
    startCometProcess(cometPath, p, this.logger);

    const start = Date.now();
    while (Date.now() - start < this.config.timeout) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        return await this.connect();
      } catch {}
    }

    throw new CometLaunchError("Comet failed to start within timeout");
  }

  async closeExtraTabs(): Promise<void> {
    const cat = await this.listTabsCategorized();
    const toClose = [
      ...cat.sidecar,
      ...cat.agentBrowsing,
      ...cat.overlay,
      ...cat.others,
    ];

    for (const tab of toClose) {
      try {
        if (this.criClient)
          await this.criClient.Target.closeTarget({ targetId: tab.id });
      } catch {
        try {
          await windowsFetch(
            `http://127.0.0.1:${this.state.port}/json/close/${tab.id}`,
          );
        } catch {}
      }
    }
  }
}
