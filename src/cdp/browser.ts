import { execSync, spawn } from "node:child_process";
import { CometNotFoundError } from "../errors.js";
import type { Logger } from "../logger.js";

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function isMac(): boolean {
  return process.platform === "darwin";
}

export function isWSL(): boolean {
  try {
    const release = execSync("uname -r", { encoding: "utf8" });
    return (
      release.toLowerCase().includes("microsoft") ||
      release.toLowerCase().includes("wsl")
    );
  } catch {
    return false;
  }
}

export function getCometPath(): string {
  const envPath = process.env.COMET_PATH;
  if (envPath) return envPath;

  if (isWindows() || isWSL()) {
    const candidates = [
      process.env.LOCALAPPDATA
        ? `${process.env.LOCALAPPDATA}\\Perplexity\\Comet\\Application\\comet.exe`
        : null,
      process.env.PROGRAMFILES
        ? `${process.env.PROGRAMFILES}\\Perplexity\\Comet\\Application\\comet.exe`
        : null,
      process.env["PROGRAMFILES(X86)"]
        ? `${process.env["PROGRAMFILES(X86)"]}\\Perplexity\\Comet\\Application\\comet.exe`
        : null,
    ].filter(Boolean);
    for (const candidate of candidates) {
      try {
        execSync(`if exist "${candidate}" (exit 0) else (exit 1)`, {
          shell: "cmd.exe",
        });
        return candidate!;
      } catch {}
    }
  }

  if (isMac()) {
    const macPath = "/Applications/Comet.app/Contents/MacOS/Comet";
    try {
      execSync(`test -f "${macPath}"`, { shell: "/bin/bash" });
      return macPath;
    } catch {}
  }

  throw new CometNotFoundError(
    "Comet browser not found. Set COMET_PATH env var or install Perplexity Comet.",
  );
}

export async function windowsFetch(
  url: string,
): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}> {
  try {
    const result = execSync(
      `powershell.exe -NoProfile -Command "Invoke-WebRequest -Uri '${url}' -UseBasicParsing | Select-Object -ExpandProperty Content"`,
      { encoding: "utf8", timeout: 10000 },
    );
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(result),
    };
  } catch {
    return { ok: false, status: 0, json: async () => null };
  }
}

export function isCometProcessRunning(): boolean {
  try {
    if (isWindows()) {
      const r = execSync('tasklist /FI "IMAGENAME eq comet.exe"', {
        encoding: "utf8",
      });
      return r.toLowerCase().includes("comet.exe");
    }
    const r = execSync("pgrep -f Comet.app || true", {
      encoding: "utf8",
      shell: "/bin/bash",
    });
    return r.trim().length > 0;
  } catch {
    return false;
  }
}

export function killComet(): void {
  try {
    if (isWindows())
      execSync("taskkill /F /IM comet.exe", { stdio: "ignore" });
    else
      execSync("pkill -f 'Comet.app'", { stdio: "ignore", shell: "/bin/bash" });
  } catch {}
}

export function startCometProcess(
  cometPath: string,
  port: number,
  logger: Logger,
): void {
  const args = [`--remote-debugging-port=${port}`];
  logger.info(`Launching Comet: ${cometPath} ${args.join(" ")}`);
  const child = spawn(cometPath, args, {
    detached: true,
    stdio: "ignore",
    shell: isWindows(),
  });
  child.unref();
}
