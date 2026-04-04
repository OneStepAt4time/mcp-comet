import { TabCategory } from "../types.js";
import type { TabInfo, CategorizedTabs } from "../types.js";

export function categorizeTabs(tabs: TabInfo[]): CategorizedTabs {
  const result: CategorizedTabs = {
    main: [],
    sidecar: [],
    agentBrowsing: [],
    overlay: [],
    others: [],
  };

  for (const tab of tabs) {
    if (tab.type !== "page") {
      result.others.push({ ...tab, category: TabCategory.Other });
      continue;
    }

    const url = tab.url.toLowerCase();

    if (url.includes("chrome-extension://") && url.includes("overlay")) {
      result.overlay.push({ ...tab, category: TabCategory.Overlay });
    } else if (url.includes("sidecar")) {
      result.sidecar.push({ ...tab, category: TabCategory.Sidecar });
    } else if (url.includes("perplexity.ai")) {
      result.main.push({ ...tab, category: TabCategory.Main });
    } else if (
      !url.startsWith("chrome://") &&
      !url.startsWith("chrome-extension://") &&
      url !== "about:blank"
    ) {
      result.agentBrowsing.push({ ...tab, category: TabCategory.AgentBrowsing });
    } else {
      result.others.push({ ...tab, category: TabCategory.Other });
    }
  }

  return result;
}
