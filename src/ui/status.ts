import { buildFindProseJS } from '../prose-filter.js'
import type { SelectorSet } from '../selectors/types.js'
import { SELECTORS } from './selectors.js'

export function buildGetAgentStatusScript(selectors?: SelectorSet): string {
  const loadingSelectors = selectors?.LOADING ?? SELECTORS.LOADING
  const findProseBody = buildFindProseJS()
  return `(function() {
    var status = "idle";
    var steps = [];
    var currentStep = "";
    var response = "";
    var hasStopButton = false;
    var hasLoadingSpinner = false;

    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (label.indexOf('stop') !== -1 || label.indexOf('cancel') !== -1) { hasStopButton = true; break; }
      var svg = btn.querySelector('svg rect');
      if (svg) { hasStopButton = true; break; }
    }

    var spinSelectors = ${JSON.stringify([...loadingSelectors])};
    for (var s = 0; s < spinSelectors.length; s++) {
      if (document.querySelector(spinSelectors[s])) { hasLoadingSpinner = true; break; }
    }

    var bodyText = document.body ? document.body.innerText : '';
    var workingPatterns = ['Working', 'Searching', 'Reviewing sources', 'Preparing to assist', 'Clicking', 'Typing:', 'Navigating to', 'Reading', 'Analyzing'];
    var hasWorkingText = false;
    for (var w = 0; w < workingPatterns.length; w++) {
      if (bodyText.indexOf(workingPatterns[w]) !== -1) { hasWorkingText = true; break; }
    }

    var stepPatterns = [/Preparing to assist[^\\n]*/g, /Clicking[^\\n]*/g, /Typing:[^\\n]*/g, /Navigating to[^\\n]*/g, /Reading[^\\n]*/g, /Searching[^\\n]*/g, /Found[^\\n]*/g];
    var seenSteps = {};
    for (var sp = 0; sp < stepPatterns.length; sp++) {
      var matches = bodyText.match(stepPatterns[sp]);
      if (matches) { for (var m = 0; m < matches.length; m++) { var step = matches[m].trim(); if (step && !seenSteps[step]) { seenSteps[step] = true; steps.push(step); currentStep = step; } } }
    }

    ${findProseBody}
    if (results.length > 0) {
      response = results[results.length - 1];
      response = response.replace(/View All/g, '').replace(/Show more/g, '').replace(/Ask a follow-up/g, '').replace(/\\d+ sources/g, '');
      if (response.length > 8000) response = response.substring(0, 8000);
    }

    if (hasStopButton || hasLoadingSpinner) status = "working";
    else if (bodyText.indexOf('Steps completed') !== -1 || (bodyText.indexOf('Finished') !== -1 && !hasStopButton)) status = "completed";
    else if (/Reviewed\\s+\\d+\\s+sources/.test(bodyText) && !hasWorkingText) status = "completed";
    else if (hasWorkingText) status = "working";
    else if (bodyText.indexOf('Ask a follow-up') !== -1 && results.length > 0 && !hasStopButton) status = "completed";

    return JSON.stringify({ status: status, steps: steps, currentStep: currentStep, response: response, hasStopButton: hasStopButton, hasLoadingSpinner: hasLoadingSpinner, proseCount: results.length });
  })()`
}
