import type { SelectorSet } from '../selectors/types.js'
import { SELECTORS } from './selectors.js'

export function buildTypePromptScript(prompt: string, selectors?: SelectorSet): string {
  const escaped = prompt
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')
  const inputSelectors = selectors?.INPUT ?? SELECTORS.INPUT
  const selectorList = JSON.stringify([...inputSelectors])
  return `(function() {
    const selectors = ${selectorList};
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

export function buildFindInputScript(selectors?: SelectorSet): string {
  const inputSelectors = selectors?.INPUT ?? SELECTORS.INPUT
  const selectorList = JSON.stringify([...inputSelectors])
  return `(function() {
    const selectors = ${selectorList};
    for (const sel of selectors) { const el = document.querySelector(sel); if (el) return sel; }
    return null;
  })()`
}
