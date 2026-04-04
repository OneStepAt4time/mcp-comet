import { describe, it, expect } from "vitest";
import {
  AsteriaError,
  CDPConnectionError,
  CometNotFoundError,
  CometLaunchError,
  TabNotFoundError,
  TimeoutError,
  EvaluationError,
  SelectorError,
  AgentError,
  ConfigurationError,
  toMcpError,
} from "../src/errors.js";

describe("AsteriaError", () => {
  it("has code, message, context, and cause", () => {
    const err = new AsteriaError("test", "TEST_CODE", { key: "val" });
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.context).toEqual({ key: "val" });
    expect(err).toBeInstanceOf(Error);
  });
});

describe("Error subclasses", () => {
  it("CDPConnectionError", () => {
    const e = new CDPConnectionError("x");
    expect(e.code).toBe("CDP_CONNECTION_FAILED");
    expect(e).toBeInstanceOf(AsteriaError);
  });
  it("CometNotFoundError", () => {
    const e = new CometNotFoundError("x");
    expect(e.code).toBe("COMET_NOT_FOUND");
  });
  it("CometLaunchError", () => {
    const e = new CometLaunchError("x");
    expect(e.code).toBe("COMET_LAUNCH_FAILED");
  });
  it("TabNotFoundError", () => {
    const e = new TabNotFoundError("x", { tabId: "1" });
    expect(e.code).toBe("TAB_NOT_FOUND");
    expect(e.context).toEqual({ tabId: "1" });
  });
  it("TimeoutError", () => {
    const e = new TimeoutError("x", { op: "ask" });
    expect(e.code).toBe("TIMEOUT");
  });
  it("EvaluationError", () => {
    const e = new EvaluationError("x");
    expect(e.code).toBe("EVALUATION_FAILED");
  });
  it("SelectorError", () => {
    const e = new SelectorError("x", { sel: ".p" });
    expect(e.code).toBe("SELECTOR_NOT_FOUND");
  });
  it("AgentError", () => {
    const e = new AgentError("x");
    expect(e.code).toBe("AGENT_ERROR");
  });
  it("ConfigurationError", () => {
    const e = new ConfigurationError("x");
    expect(e.code).toBe("CONFIG_ERROR");
  });
});

describe("toMcpError", () => {
  it("converts AsteriaError to MCP format", () => {
    const r = toMcpError(new CDPConnectionError("conn fail"));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("CDP_CONNECTION_FAILED");
  });
  it("converts plain Error to MCP format", () => {
    const r = toMcpError(new Error("oops"));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("oops");
  });
});
