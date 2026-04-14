/**
 * Build script to click an action button on a Comet permission/confirmation prompt.
 * @param action - Which button to click: "primary" (the main action, e.g., "Create Issue")
 *                 or "cancel" (the cancel/dismiss button). Defaults to "primary".
 */
export function buildClickActionButtonScript(action: 'primary' | 'cancel' = 'primary'): string {
  return `(function() {
    var bannerSelectors = ['[class*="@container/banner"]'];
    for (var bs = 0; bs < bannerSelectors.length; bs++) {
      var banner = document.querySelector(bannerSelectors[bs]);
      if (!banner) continue;

      var bannerBtns = banner.querySelectorAll('button');
      var primaryBtn = null;
      var cancelBtn = null;

      for (var i = 0; i < bannerBtns.length; i++) {
        var btn = bannerBtns[i];
        var text = (btn.textContent || '').trim();
        if (!text || text.length <= 1 || text === 'Show more') continue;

        var classes = btn.className || '';
        // Primary action buttons have bg-button-bg (filled), cancel has border-subtle (outlined)
        if (classes.indexOf('bg-button-bg') !== -1) {
          primaryBtn = btn;
        } else if (classes.indexOf('border-subtle') !== -1 || text.toLowerCase() === 'cancel') {
          cancelBtn = btn;
        }
      }

      var target = ${action === 'primary' ? 'primaryBtn' : 'cancelBtn'};
      if (target) {
        target.click();
        return JSON.stringify({ clicked: true, buttonText: (target.textContent || '').trim(), action: '${action}' });
      }

      // Fallback: if no bg-button-bg found, click the first non-cancel button for primary,
      // or the last button for cancel
      if (${action === 'primary'} && bannerBtns.length > 0) {
        for (var j = 0; j < bannerBtns.length; j++) {
          var t = (bannerBtns[j].textContent || '').trim();
          if (t && t !== 'Cancel' && t !== 'Show more') {
            bannerBtns[j].click();
            return JSON.stringify({ clicked: true, buttonText: t, action: 'primary', fallback: true });
          }
        }
      }
      if (${action === 'cancel'} && cancelBtn) {
        cancelBtn.click();
        return JSON.stringify({ clicked: true, buttonText: (cancelBtn.textContent || '').trim(), action: 'cancel' });
      }
    }
    return JSON.stringify({ clicked: false, error: 'No action banner found' });
  })()`
}
