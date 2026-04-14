import { buildFindProseJS } from '../prose-filter.js'
import type { SelectorSet } from '../selectors/types.js'
import { SELECTORS } from './selectors.js'

export function buildGetAgentStatusScript(selectors?: SelectorSet): string {
  const loadingSelectors = selectors?.LOADING ?? SELECTORS.LOADING
  const actionBannerSelectors = selectors?.ACTION_BANNER ?? SELECTORS.ACTION_BANNER
  const findProseBody = buildFindProseJS()
  return `(function() {
    var status = "idle";
    var steps = [];
    var currentStep = "";
    var response = "";
    var hasStopButton = false;
    var hasLoadingSpinner = false;
    var actionPrompt = "";
    var actionButtons = [];

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
    var workingPatterns = ['Working', 'Searching', 'Reviewing sources', 'Preparing to assist', 'Clicking', 'Typing:', 'Navigating to', 'Reading', 'Analyzing', 'Ricerca', 'Analisi', 'Preparazione', 'Digitando', 'Navigazione', 'Lettura'];
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
      if (response.length > 8000) response = response.substring(0, 8000) + '\\n\\n[Response truncated. Use comet_get_page_content for the full text.]';
    }

    if (hasStopButton || hasLoadingSpinner) status = "working";
    else if (hasWorkingText) status = "working";
    else if (results.length > 0) status = "completed";

    // Detect action/permission prompts (Comet asks user to confirm before executing actions)
    var bannerSelectors = ${JSON.stringify([...actionBannerSelectors])};
    for (var bs = 0; bs < bannerSelectors.length; bs++) {
      var banner = document.querySelector(bannerSelectors[bs]);
      if (banner) {
        // Extract the prompt text (text inside the banner card, excluding button text)
        var bannerCard = banner.querySelector('[class*="bg-subtle"]');
        if (bannerCard) {
          var bannerText = (bannerCard.textContent || '').trim();
          // Collect action buttons (buttons with visible text, not UI buttons)
          var bannerBtns = banner.querySelectorAll('button');
          for (var bb = 0; bb < bannerBtns.length; bb++) {
            var btnText = (bannerBtns[bb].textContent || '').trim();
            if (btnText && btnText.length > 1 && btnText !== 'Show more') {
              actionButtons.push(btnText);
              // Remove button text from prompt text
              bannerText = bannerText.replace(btnText, '');
            }
          }
          actionPrompt = bannerText.replace(/\\s+/g, ' ').trim();
        }
        status = "awaiting_action";
        break;
      }
    }

    return JSON.stringify({ status: status, steps: steps, currentStep: currentStep, response: response, hasStopButton: hasStopButton, hasLoadingSpinner: hasLoadingSpinner, proseCount: results.length, actionPrompt: actionPrompt, actionButtons: actionButtons });
  })()`
}
