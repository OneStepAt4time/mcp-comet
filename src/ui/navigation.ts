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

/** Map internal mode names to display names shown in Comet's slash menu. */
const MODE_DISPLAY_NAMES: Record<string, string> = {
  standard: '',
  'deep-research': 'Deep research',
  'model-council': 'Model council',
  create: 'Create files and apps',
  learn: 'Learn step by step',
  review: 'Review documents',
  computer: 'Computer',
}

export function buildModeSwitchScript(mode: string): string {
  const displayName = MODE_DISPLAY_NAMES[mode] ?? mode
  return `(function() {
    var displayName = '${displayName}';
    if (!displayName) return 'standard_mode_no_action';

    // Find the contenteditable input
    var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
    if (!input) return 'no_input_found';

    // Focus and type "/" to open the typeahead menu
    input.focus();
    input.textContent = '/';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

    // Wait for the typeahead menu to appear
    var attempts = 0;
    var maxAttempts = 20;

    function tryClickMenuItem() {
      var listbox = document.querySelector('[role="listbox"]');
      if (!listbox) {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryClickMenuItem, 100);
        } else {
          return 'timeout_waiting_for_menu';
        }
        return;
      }

      // Find menuitem whose text includes the display name
      var menuItems = document.querySelectorAll('[role="menuitem"]');
      for (var i = 0; i < menuItems.length; i++) {
        var itemText = menuItems[i].textContent || '';
        if (itemText.indexOf(displayName) !== -1) {
          menuItems[i].click();
          return 'clicked:' + displayName;
        }
      }
      return 'menu_item_not_found:' + displayName;
    }

    return tryClickMenuItem();
  })()`
}

export function buildNewChatScript(): string {
  return `(function() { location.href = 'https://www.perplexity.ai'; return 'navigating'; })()`
}

export function buildGetCurrentModeScript(): string {
  return `(function() {
    // Comet's current UI has no visible mode indicator on result pages
    // Default to 'standard' mode
    var url = window.location.href;

    // Check URL patterns for mode hints
    if (url.indexOf('/copilot/') !== -1) return 'computer';

    return 'standard';
  })()`
}
