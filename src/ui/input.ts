import type { SelectorSet } from '../selectors/types.js'
import { SELECTORS } from './selectors.js'

export function buildTypePromptScript(prompt: string, selectors?: SelectorSet): string {
  // JSON.stringify handles quotes, backslashes, control chars.
  // Explicitly escape U+2028/U+2029 which JSON.stringify leaves unescaped
  // but which can break JS string literals in older engines.
  const promptLiteral = JSON.stringify(prompt).replace(/[\u2028\u2029]/g, (ch) =>
    ch === '\u2028' ? '\\u2028' : '\\u2029'
  )
  const inputSelectors = selectors?.INPUT ?? SELECTORS.INPUT
  const selectorList = JSON.stringify([...inputSelectors])
  return '(function() {\n'
    + '    const selectors = ' + selectorList + ';\n'
    + '    for (const sel of selectors) {\n'
    + '      const el = document.querySelector(sel);\n'
    + '      if (el) {\n'
    + '        if (el.contentEditable === \'true\' || el.getAttribute(\'contenteditable\') === \'true\') {\n'
    + '          el.focus();\n'
    + '          document.execCommand(\'selectAll\', false, null);\n'
    + '          document.execCommand(\'insertText\', false, ' + promptLiteral + ');\n'
    + '          if (el.innerText.trim() !== ' + promptLiteral + ') {\n'
    + '            el.focus();\n'
    + '            document.execCommand(\'selectAll\', false, null);\n'
    + '            document.execCommand(\'delete\', false, null);\n'
    + '            document.execCommand(\'insertText\', false, ' + promptLiteral + ');\n'
    + '          }\n'
    + '          return \'contenteditable:\' + sel;\n'
    + '        }\n'
    + '        if (el.tagName === \'TEXTAREA\' || el.tagName === \'INPUT\') {\n'
    + '          el.focus();\n'
    + '          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, \'value\')?.set\n'
    + '            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, \'value\')?.set;\n'
    + '          if (nativeSetter) nativeSetter.call(el, ' + promptLiteral + ');\n'
    + '          else el.value = ' + promptLiteral + ';\n'
    + '          el.dispatchEvent(new Event(\'input\', { bubbles: true }));\n'
    + '          el.dispatchEvent(new Event(\'change\', { bubbles: true }));\n'
    + '          return \'input:\' + sel;\n'
    + '        }\n'
    + '      }\n'
    + '    }\n'
    + '    return null;\n'
    + '  })()'
}

export function buildFindInputScript(selectors?: SelectorSet): string {
  const inputSelectors = selectors?.INPUT ?? SELECTORS.INPUT
  const selectorList = JSON.stringify([...inputSelectors])
  return '(function() {\n'
    + '    const selectors = ' + selectorList + ';\n'
    + '    for (const sel of selectors) { const el = document.querySelector(sel); if (el) return sel; }\n'
    + '    return null;\n'
    + '  })()'
}
