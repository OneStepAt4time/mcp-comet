/**
 * Build script to list recent conversation links visible on the page.
 */
export function buildListConversationsScript(): string {
  return `(function() {
    function dedupeTitle(text) {
      if (!text) return '';
      var half = Math.floor(text.length / 2);
      if (half > 0 && text.substring(0, half) === text.substring(half)) return text.substring(0, half);
      return text;
    }

    var links = document.querySelectorAll('a[href]');
    var conversations = [];
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('/search/') !== -1 || href.indexOf('/copilot/') !== -1 || href.indexOf('/computer/tasks/') !== -1) {
        if (!seen[href]) {
          seen[href] = true;
          conversations.push({ title: dedupeTitle((links[i].innerText || '').trim()), url: href });
        }
      }
    }
    return JSON.stringify(conversations);
  })()`
}
