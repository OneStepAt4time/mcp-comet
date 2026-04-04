import { describe, it, expect } from "vitest";
import { buildSubmitPromptScript, buildModeSwitchScript, buildNewChatScript } from "../../src/ui/navigation.js";

describe("buildSubmitPromptScript", () => { it("generates multi-strategy submit", () => { const s = buildSubmitPromptScript(); expect(s).toContain("Enter"); }); });
describe("buildModeSwitchScript", () => { it("generates dual UI mode switch", () => { const s = buildModeSwitchScript("research"); expect(s).toContain("Research"); expect(s).toContain("aria-label"); expect(s).toContain("menuitem"); }); });
describe("buildNewChatScript", () => { it("navigates to perplexity.ai", () => { const s = buildNewChatScript(); expect(s).toContain("perplexity.ai"); }); });
