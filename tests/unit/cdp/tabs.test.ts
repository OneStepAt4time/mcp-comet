import { describe, it, expect } from "vitest";
import { TabCategory } from "../../src/types.js";
import { categorizeTabs } from "../../src/cdp/tabs.js";

describe("categorizeTabs", () => {
  it("categorizes perplexity.ai as main", () => {
    const r = categorizeTabs([
      { id: "1", type: "page", title: "P", url: "https://www.perplexity.ai" },
    ]);
    expect(r.main).toHaveLength(1);
    expect(r.main[0].category).toBe(TabCategory.Main);
  });

  it("categorizes sidecar", () => {
    const r = categorizeTabs([
      { id: "1", type: "page", title: "P", url: "https://www.perplexity.ai" },
      {
        id: "2",
        type: "page",
        title: "S",
        url: "https://www.perplexity.ai/sidecar?q=test",
      },
    ]);
    expect(r.sidecar).toHaveLength(1);
  });

  it("categorizes non-perplexity as agentBrowsing", () => {
    const r = categorizeTabs([
      { id: "1", type: "page", title: "P", url: "https://www.perplexity.ai" },
      {
        id: "2",
        type: "page",
        title: "W",
        url: "https://en.wikipedia.org/wiki/Test",
      },
    ]);
    expect(r.agentBrowsing).toHaveLength(1);
  });

  it("categorizes chrome-extension overlay", () => {
    const r = categorizeTabs([
      { id: "1", type: "page", title: "P", url: "https://www.perplexity.ai" },
      {
        id: "2",
        type: "page",
        title: "O",
        url: "chrome-extension://abc123/overlay.html",
      },
    ]);
    expect(r.overlay).toHaveLength(1);
  });

  it("puts unknown types in others", () => {
    const r = categorizeTabs([
      { id: "1", type: "background", title: "BG", url: "chrome-extension://xyz" },
    ]);
    expect(r.others).toHaveLength(1);
  });

  it("empty input", () => {
    const r = categorizeTabs([]);
    expect(r.main).toHaveLength(0);
    expect(r.others).toHaveLength(0);
  });
});
