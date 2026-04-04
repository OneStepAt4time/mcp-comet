/**
 * Shared prose filtering logic used by both agent status detection
 * and pre-send state capture in comet_ask.
 */

/** Tags to exclude when scanning for prose content. */
const EXCLUDE_TAGS = ["NAV", "ASIDE", "HEADER", "FOOTER", "FORM"] as const;

/** UI text patterns that indicate non-response prose elements. */
const UI_TEXT_PREFIXES = [
  "Library",
  "Discover",
  "Spaces",
  "Finance",
  "Account",
  "Upgrade",
  "Home",
  "Search",
  "Ask a follow-up",
] as const;

/**
 * Build the JS expression body (not wrapped in IIFE) for finding valid prose elements.
 * Used by both status detection and pre-send state capture scripts.
 */
export function buildFindProseJS(): string {
  return `var proseElements = document.querySelectorAll('main [class*="prose"], body > [class*="prose"]');
    var excludeTags = ['NAV', 'ASIDE', 'HEADER', 'FOOTER', 'FORM'];
    var uiTexts = ['Library', 'Discover', 'Spaces', 'Finance', 'Account', 'Upgrade', 'Home', 'Search', 'Ask a follow-up'];
    var results = [];
    for (var i = 0; i < proseElements.length; i++) {
      var el = proseElements[i];
      var parent = el.parentElement;
      var excluded = false;
      while (parent) { if (excludeTags.indexOf(parent.tagName) !== -1) { excluded = true; break; } parent = parent.parentElement; }
      if (excluded) continue;
      var text = el.innerText ? el.innerText.trim() : '';
      if (!text) continue;
      var isUI = false;
      for (var u = 0; u < uiTexts.length; u++) { if (text.indexOf(uiTexts[u]) === 0) { isUI = true; break; } }
      if (isUI) continue;
      if (text.length < 100 && text.indexOf('?') === text.length - 1) continue;
      results.push(text);
    }
    results`;
}

/**
 * Build a full IIFE script that returns pre-send state as JSON.
 * Returns { proseCount: number, lastProseText: string }.
 */
export function buildPreSendStateScript(): string {
  return `(function() {
    ${buildFindProseJS()}
    return JSON.stringify({ proseCount: results.length, lastProseText: results.length > 0 ? results[results.length - 1] : '' });
  })()`;
}
