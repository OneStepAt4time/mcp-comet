import { SELECTORS } from './selectors.js'

export function buildTypePromptScript(prompt: string): string {
  const escaped = prompt
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')
  const selectors = JSON.stringify([...SELECTORS.INPUT])
  return `(function() {
    const selectors = ${selectors};
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        if (el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true') {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, '${escaped}');
          if (el.innerText.trim() !== '${escaped}') {
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, '${escaped}');
          }
          return 'contenteditable:' + sel;
        }
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.focus();
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, '${escaped}');
          else el.value = '${escaped}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return 'input:' + sel;
        }
      }
    }
    return null;
  })()`
}

export function buildFindInputScript(): string {
  const selectors = JSON.stringify([...SELECTORS.INPUT])
  return `(function() {
    const selectors = ${selectors};
    for (const sel of selectors) { const el = document.querySelector(sel); if (el) return sel; }
    return null;
  })()`
}
