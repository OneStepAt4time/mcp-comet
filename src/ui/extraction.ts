export function buildExtractSourcesScript(): string {
  return `(function() {
    function isInternalLink(url) {
      if (!url) return true;
      try {
        var hostname = new URL(url).hostname;
        return hostname === 'perplexity.ai' || hostname.endsWith('.perplexity.ai');
      } catch (e) {
        return true;
      }
    }

    function extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return '';
      }
    }

    function findLinksInTabpanel() {
      var tabpanels = document.querySelectorAll('[role="tabpanel"]');
      var sources = [];
      var seenUrls = {};

      for (var t = 0; t < tabpanels.length; t++) {
        var tabpanel = tabpanels[t];
        var anchors = tabpanel.querySelectorAll('a[href]');

        for (var i = 0; i < anchors.length; i++) {
          var a = anchors[i];
          var href = a.href;
          var text = (a.innerText || '').trim();

          if (!href || seenUrls[href]) continue;
          if (href.indexOf('javascript:') === 0) continue;
          if (href.indexOf('#') === href.length - 1) continue;
          if (isInternalLink(href)) continue;

          seenUrls[href] = true;
          sources.push({
            url: href,
            title: text || extractDomain(href) || href
          });
        }
      }
      return sources;
    }

    var sources = findLinksInTabpanel();
    return JSON.stringify(sources);
  })()`
}

export function buildExtractPageContentScript(maxLength = 10000): string {
  return `(function() {
    var body = document.body;
    if (!body) return JSON.stringify({ text: '', title: '' });
    var text = body.innerText || '';
    text = text.replace(/^\\s*(Sign in|Log in|Get the app|Download)/gm, '');
    if (text.length > ${maxLength}) text = text.substring(0, ${maxLength});
    return JSON.stringify({ text: text, title: document.title || '' });
  })()`
}
