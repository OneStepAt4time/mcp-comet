export function buildSubmitPromptScript(): string {
  return `(function() {
    var active = document.activeElement;
    if (active) {
      active.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true}));
      active.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', bubbles: true}));
    }
    return 'submitted';
  })()`
}

/** Map internal mode names to SVG icon href identifiers (locale-independent). */
const MODE_ICONS: Record<string, string> = {
  standard: '',
  'deep-research': '#pplx-icon-telescope',
  'model-council': '#pplx-icon-gavel',
  create: '#pplx-icon-custom-computer',
  learn: '#pplx-icon-book',
  review: '#pplx-icon-file-check',
  computer: '#pplx-icon-click',
}

/**
 * Build script to click a mode item in the typeahead menu.
 * The caller MUST inject '/' via CDP Input API before running this script.
 * Matching is done by SVG icon href — locale-independent.
 */
export function buildModeSwitchScript(mode: string): string {
  const iconHref = MODE_ICONS[mode] ?? (mode ? `#pplx-icon-${mode}` : '')
  return `(function() {
    var iconHref = ${JSON.stringify(iconHref)};
    if (!iconHref) return 'standard_mode_no_action';

    var listbox = document.querySelector('[role="listbox"]');
    if (!listbox) return 'no_listbox_found';

    var menuItems = document.querySelectorAll('[role="menuitem"]');
    for (var i = 0; i < menuItems.length; i++) {
      var item = menuItems[i];
      // Skip shortcut items (slash commands like /write, /teach-me-comet)
      if (item.className.indexOf('shortcut-typeahead-option') !== -1) continue;

      // Match by icon SVG use href
      var useEls = item.querySelectorAll('use');
      for (var u = 0; u < useEls.length; u++) {
        var href = useEls[u].getAttribute('xlink:href') || useEls[u].getAttribute('href') || '';
        if (href === iconHref) {
          item.click();
          return 'clicked:' + iconHref;
        }
      }
    }
    return 'menu_item_not_found:' + iconHref;
  })()`
}

export function buildNewChatScript(): string {
  return `(function() { location.href = 'https://www.perplexity.ai'; return 'navigating'; })()`
}

export function buildGetCurrentModeScript(): string {
  return `(function() {
    var url = window.location.href;
    if (url.indexOf('/copilot/') !== -1) return 'computer';
    if (url.indexOf('/computer/tasks/') !== -1) return 'computer';
    return 'standard';
  })()`
}
