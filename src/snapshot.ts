import { CDPClient } from './cdp/client.js'

export async function runSnapshot(): Promise<void> {
  const client = CDPClient.getInstance()

  await client.launchOrConnect()

  const script = `(function() {
    var results = {};
    var inputs = [];
    var inputSels = ['[contenteditable="true"]', 'textarea', 'input[type="text"]'];
    for (var s = 0; s < inputSels.length; s++) {
      var els = document.querySelectorAll(inputSels[s]);
      for (var i = 0; i < els.length; i++) {
        inputs.push({ selector: inputSels[s], tag: els[i].tagName, class: (els[i].className || '').substring(0, 80), visible: els[i].offsetParent !== null });
      }
    }
    results.inputs = inputs;
    var btns = document.querySelectorAll('button');
    var labeledBtns = [];
    for (var b = 0; b < btns.length; b++) {
      var label = btns[b].getAttribute('aria-label') || '';
      var text = (btns[b].innerText || '').trim().substring(0, 30);
      if (label || text) labeledBtns.push({ ariaLabel: label, text: text, class: (btns[b].className || '').substring(0, 60) });
    }
    results.buttons = labeledBtns.slice(0, 50);
    results.proseCount = document.querySelectorAll('main [class*="prose"], body > [class*="prose"]').length;
    return JSON.stringify(results, null, 2);
  })()`

  const result = await client.safeEvaluate(script)
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error('Comet DOM Snapshot:')
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(result.result?.value)
  await client.disconnect()
}
