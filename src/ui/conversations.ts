/**
 * Build script to list recent conversation links visible on the page.
 */
export function buildListConversationsScript(): string {
  return `(function() {
    var links = document.querySelectorAll('a[href]');
    var conversations = [];
    var seen = {};
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (href.indexOf('/search/') !== -1 || href.indexOf('/copilot/') !== -1) {
        if (!seen[href]) {
          seen[href] = true;
          conversations.push({ title: (links[i].innerText || '').trim(), url: href });
        }
      }
    }
    return JSON.stringify(conversations);
  })()`
}
