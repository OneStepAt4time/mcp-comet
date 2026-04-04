export function buildExtractSourcesScript(): string {
  return `(function() {
    var container = document.querySelector('main') || document.body;
    var anchors = container.querySelectorAll('a[href]');
    var seenUrls = {};
    var sources = [];
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.href;
      var text = (a.innerText || '').trim();
      if (!href || seenUrls[href]) continue;
      if (href.indexOf('javascript:') === 0) continue;
      if (href.indexOf('#') === href.length - 1) continue;
      seenUrls[href] = true;
      sources.push({ url: href, title: text || href });
    }
    return JSON.stringify(sources);
  })()`;
}

export function buildExtractPageContentScript(maxLength = 10000): string {
  return `(function() {
    var body = document.body;
    if (!body) return JSON.stringify({ text: '', title: '' });
    var text = body.innerText || '';
    text = text.replace(/^\\s*(Sign in|Log in|Get the app|Download)/gm, '');
    if (text.length > ${maxLength}) text = text.substring(0, ${maxLength});
    return JSON.stringify({ text: text, title: document.title || '' });
  })()`;
}
