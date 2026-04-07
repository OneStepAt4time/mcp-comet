/**
 * Build script to stop the currently running agent by clicking the stop/cancel button.
 */
export function buildStopAgentScript(): string {
  return `(function() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var label = (buttons[i].getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('stop') !== -1 || label.indexOf('cancel') !== -1) { buttons[i].click(); return 'stopped'; }
      if (buttons[i].querySelector('svg rect')) { buttons[i].click(); return 'stopped'; }
    }
    return 'not_found';
  })()`
}
