import { describe, it, expect } from "vitest";
import { buildTypePromptScript } from "../../src/ui/input.js";

describe("buildTypePromptScript", () => {
  it("escapes quotes", () => { const s = buildTypePromptScript('he said "hello"'); expect(s).not.toContain('he said "hello"'); });
  it("escapes newlines", () => { const s = buildTypePromptScript("line1\nline2"); expect(s).toContain("line1\\nline2"); });
  it("uses execCommand for contenteditable", () => { const s = buildTypePromptScript("test"); expect(s).toContain("execCommand"); expect(s).toContain("insertText"); });
});
