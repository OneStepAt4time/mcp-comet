export function buildSubmitPromptScript(): string {
  return `(function() {
    var active = document.activeElement;
    if (active) {
      active.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true}));
      active.dispatchEvent(new KeyboardEvent('keyup', {key: 'Enter', code: 'Enter', bubbles: true}));
    }
    return 'submitted';
  })()`;
}

export function buildModeSwitchScript(mode: string): string {
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  return `(function() {
    var mode = '${modeLabel}';
    var btn = document.querySelector('button[aria-label="' + mode + '"]');
    if (btn) { btn.click(); return 'clicked:' + mode; }
    var allBtns = document.querySelectorAll('button');
    var modeNames = ['Search', 'Research', 'Labs', 'Learn'];
    var dropdownBtn = null;
    for (var i = 0; i < allBtns.length; i++) {
      var b = allBtns[i];
      var label = (b.getAttribute('aria-label') || b.innerText || '').trim();
      var svg = b.querySelector('svg');
      if (svg && !dropdownBtn) { for (var m = 0; m < modeNames.length; m++) { if (label.indexOf(modeNames[m]) !== -1) { dropdownBtn = b; break; } } }
    }
    if (dropdownBtn) {
      dropdownBtn.click();
      var startTime = Date.now();
      var check = setInterval(function() {
        var items = document.querySelectorAll('[role="menuitem"], [role="option"]');
        for (var j = 0; j < items.length; j++) { if (items[j].innerText.indexOf(mode) !== -1) { clearInterval(check); items[j].click(); return; } }
        if (Date.now() - startTime > 2000) clearInterval(check);
      }, 100);
      return 'dropdown:' + mode;
    }
    return 'not_found:' + mode;
  })()`;
}

export function buildNewChatScript(): string {
  return `(function() { location.href = 'https://www.perplexity.ai'; return 'navigating'; })()`;
}

export function buildGetCurrentModeScript(): string {
  return `(function() {
    var modes = ['Search', 'Research', 'Labs', 'Learn'];
    for (var i = 0; i < modes.length; i++) {
      var btn = document.querySelector('button[aria-label="' + modes[i] + '"]');
      if (btn) { var state = btn.getAttribute('data-state'); if (state === 'checked') return modes[i].toLowerCase(); }
    }
    return 'unknown';
  })()`;
}
