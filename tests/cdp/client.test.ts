import { describe, it, expect, beforeEach } from "vitest";
import { CDPClient } from "../../src/cdp/client.js";

describe("CDPClient singleton", () => {
  beforeEach(() => {
    CDPClient.resetInstance();
  });

  it("returns same instance", () => {
    const a = CDPClient.getInstance();
    const b = CDPClient.getInstance();
    expect(a).toBe(b);
  });

  it("initializes with default state", () => {
    const client = CDPClient.getInstance();
    expect(client.state.connected).toBe(false);
    expect(client.state.targetId).toBeNull();
    expect(client.state.reconnectAttempts).toBe(0);
  });

  it("normalizePrompt strips bullets and collapses whitespace", () => {
    const client = CDPClient.getInstance();
    expect(client.normalizePrompt("- item 1\n- item 2\n- item 3")).toBe(
      "item 1 item 2 item 3",
    );
    expect(client.normalizePrompt("* bullet\n\n* another")).toBe(
      "bullet another",
    );
    expect(client.normalizePrompt("  multiple   spaces  ")).toBe(
      "multiple spaces",
    );
  });
});
