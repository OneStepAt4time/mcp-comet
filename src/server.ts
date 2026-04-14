import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { CDPClient } from './cdp/client.js'
import { loadConfig } from './config.js'
import { EvaluationError, toMcpError } from './errors.js'
import { createLogger } from './logger.js'
import { buildPreSendStateScript } from './prose-filter.js'
import type { SelectorSet } from './selectors/types.js'
import type { AgentStatus, CategorizedTabs, TabInfo } from './types.js'
import { buildListConversationsScript } from './ui/conversations.js'
import {
  buildExpandCollapsedCitationsScript,
  buildExtractPageContentScript,
  buildExtractSourcesScript,
} from './ui/extraction.js'
import { buildTypePromptScript } from './ui/input.js'
import {
  buildModeSwitchScript,
  buildReadActiveModeScript,
  buildSubmitPromptScript,
} from './ui/navigation.js'
import { SELECTORS } from './ui/selectors.js'
import { buildGetAgentStatusScript } from './ui/status.js'
import { buildClickActionButtonScript } from './ui/action.js'
import { buildStopAgentScript } from './ui/stop.js'
import { isPerplexityDomain } from './utils.js'
import { detectCometVersion } from './version.js'

// ---------------------------------------------------------------------------
// Configuration & singletons
// ---------------------------------------------------------------------------

const config = loadConfig()
const logger = createLogger(config.logLevel)
const client = CDPClient.getInstance(config)

/** Active selector set — updated after each comet_connect to match Comet's Chrome version. */
let activeSelectors: SelectorSet = SELECTORS

/** Guard: deduplicate concurrent ensureConnected calls. */
let connectPromise: Promise<void> | null = null

/** Ensure the client is connected before using tools. Auto-connects if needed. */
async function ensureConnected(): Promise<void> {
  if (client.state.targetId) return
  if (connectPromise) return connectPromise
  logger.info('Auto-connecting to Comet...')
  connectPromise = (async () => {
    try {
      await client.launchOrConnect()
      await client.closeExtraTabs()
      try {
        const { chromeMajor, selectors } = await detectCometVersion(config.port)
        activeSelectors = selectors
        logger.info(`Auto-connected to Comet Chrome/${chromeMajor}`)
      } catch {
        // Version detection failure is non-fatal
      }
    } finally {
      connectPromise = null
    }
  })()
  return connectPromise
}

/** Guard: prevent concurrent comet_ask calls from corrupting each other. */
let askInProgress = false

// ---------------------------------------------------------------------------
// Tool definitions (exported for testing)
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

/** Recursively unwrap ZodOptional/ZodNullable to get the inner type. */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema
  let maxDepth = 5
  while (maxDepth-- > 0 && (current instanceof z.ZodOptional || current instanceof z.ZodNullable)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: Zod internal API access
    current = (current as any)._def.innerType as z.ZodTypeAny
  }
  return current
}

/** Check if schema is optional or nullable at any level. */
function isOptionalish(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodNullable
}

/** Build a JSON-schema-shaped object from a zod raw shape for the exported registry. */
function buildInputSchema(shape: Record<string, z.ZodTypeAny>): ToolDef['inputSchema'] {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, schema] of Object.entries(shape)) {
    const entry: Record<string, unknown> = {}
    const inner = unwrapSchema(schema)

    if (inner instanceof z.ZodString) {
      entry.type = 'string'
    } else if (inner instanceof z.ZodNumber) {
      entry.type = 'number'
    } else if (inner instanceof z.ZodBoolean) {
      entry.type = 'boolean'
    } else if (inner instanceof z.ZodEnum) {
      entry.type = 'string'
      entry.enum = [...inner.options]
    } else {
      entry.type = 'string'
    }

    if (schema.description) {
      entry.description = schema.description
    }

    properties[key] = entry

    if (!isOptionalish(schema)) {
      required.push(key)
    }
  }

  const result: Record<string, unknown> = { type: 'object', properties }
  if (required.length > 0) result.required = required
  return result as ToolDef['inputSchema']
}

// Zod raw shapes for tool parameters
const connectShape = { port: z.number().optional() }
const askShape = {
  prompt: z.string().min(1).describe('The question or instruction to send to Perplexity Comet'),
  newChat: z.boolean().optional().describe('Start a fresh chat before sending the prompt'),
}
const screenshotShape = {
  format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
}
const modeShape = {
  mode: z
    .enum(['standard', 'deep-research', 'model-council', 'create', 'learn', 'review', 'computer'])
    .nullable()
    .optional()
    .describe(
      'Mode to switch to via slash command. Omit or null to query current mode. Available: standard (default search), deep-research, model-council, create, learn, review, computer.',
    ),
}
const switchTabShape = {
  tabId: z.string().optional().describe('Exact tab ID to switch to'),
  title: z.string().optional().describe('Substring of the tab title to switch to'),
}
const openConversationShape = { url: z.string().describe('Full URL of the conversation to open') }
const getPageContentShape = {
  maxLength: z.number().optional().describe('Maximum characters of page text to extract'),
}
const waitShape = {
  timeout: z.number().optional().describe('Maximum wait time in ms (default: 120000)'),
}
const approveActionShape = {
  action: z
    .enum(['primary', 'cancel'])
    .optional()
    .describe(
      'Which button to click: "primary" (approve/confirm the action, default) or "cancel" (dismiss the prompt).',
    ),
}

export const toolDefinitions: ToolDef[] = [
  {
    name: 'comet_connect',
    description:
      'Connect to or launch the Perplexity Comet browser. Closes extra tabs and navigates to perplexity.ai.',
    inputSchema: buildInputSchema(connectShape),
  },
  {
    name: 'comet_ask',
    description:
      'Send a prompt to Perplexity Comet and return immediately. Supports newChat to start fresh. Use comet_poll or comet_wait to get the response.',
    inputSchema: buildInputSchema(askShape),
  },
  {
    name: 'comet_poll',
    description: 'Poll the current agent status, steps, and response content.',
    inputSchema: buildInputSchema({}),
  },
  {
    name: 'comet_stop',
    description: 'Stop the currently running agent by clicking the stop/cancel button.',
    inputSchema: buildInputSchema({}),
  },
  {
    name: 'comet_screenshot',
    description: 'Take a screenshot of the current Comet browser tab.',
    inputSchema: buildInputSchema(screenshotShape),
  },
  {
    name: 'comet_mode',
    description:
      'Get or switch the current Comet mode. Modes are accessed via "/" slash command in the input field. Available: standard (default), deep-research, model-council, create, learn, review, computer.',
    inputSchema: buildInputSchema(modeShape),
  },
  {
    name: 'comet_list_tabs',
    description:
      'List all browser tabs categorized by role (main, sidecar, agent-browsing, overlay, other).',
    inputSchema: buildInputSchema({}),
  },
  {
    name: 'comet_switch_tab',
    description: 'Switch to a different browser tab by ID or title substring.',
    inputSchema: buildInputSchema(switchTabShape),
  },
  {
    name: 'comet_get_sources',
    description: 'Extract and list the sources/citations from the current Comet response.',
    inputSchema: buildInputSchema({}),
  },
  {
    name: 'comet_list_conversations',
    description: 'List recent conversation links visible on the page.',
    inputSchema: buildInputSchema({}),
  },
  {
    name: 'comet_open_conversation',
    description: 'Navigate to a specific conversation URL.',
    inputSchema: buildInputSchema(openConversationShape),
  },
  {
    name: 'comet_get_page_content',
    description: 'Extract the current page content (title and body text) up to a maximum length.',
    inputSchema: buildInputSchema(getPageContentShape),
  },
  {
    name: 'comet_wait',
    description:
      'Poll until the current agent finishes responding and return the full response. Use after comet_ask times out.',
    inputSchema: buildInputSchema(waitShape),
  },
  {
    name: 'comet_approve_action',
    description:
      'Click an action button on a Comet permission/confirmation prompt. Use after comet_wait or comet_poll returns status "awaiting_action".',
    inputSchema: buildInputSchema(approveActionShape),
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

function extractValue(result: {
  result?: { value?: unknown; description?: string }
  exceptionDetails?: unknown
}): unknown {
  if (result.exceptionDetails) {
    const desc = result.result?.description ?? String(result.exceptionDetails)
    throw new EvaluationError(`Script error: ${desc}`, { expression: '(unknown)' })
  }
  return result.result?.value
}

const DEFAULT_STATUS: AgentStatus = {
  status: 'idle',
  steps: [],
  currentStep: '',
  response: '',
  hasStopButton: false,
  proseCount: 0,
}

function parseAgentStatus(raw: unknown): AgentStatus {
  let parsed: unknown
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ...DEFAULT_STATUS }
    }
  } else {
    parsed = raw
  }
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATUS }
  const obj = parsed as Record<string, unknown>
  return {
    status: (typeof obj.status === 'string' ? obj.status : 'idle') as AgentStatus['status'],
    steps: Array.isArray(obj.steps) ? obj.steps as string[] : [],
    currentStep: typeof obj.currentStep === 'string' ? obj.currentStep : '',
    response: typeof obj.response === 'string' ? obj.response : '',
    hasStopButton: typeof obj.hasStopButton === 'boolean' ? obj.hasStopButton : false,
    hasLoadingSpinner: typeof obj.hasLoadingSpinner === 'boolean' ? obj.hasLoadingSpinner : undefined,
    proseCount: typeof obj.proseCount === 'number' ? obj.proseCount : undefined,
    actionPrompt: typeof obj.actionPrompt === 'string' ? obj.actionPrompt : undefined,
    actionButtons: Array.isArray(obj.actionButtons) ? obj.actionButtons as string[] : undefined,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatTabs(categorized: CategorizedTabs): string {
  const lines: string[] = []
  const categories = [
    { label: 'Main', tabs: categorized.main },
    { label: 'Sidecar', tabs: categorized.sidecar },
    { label: 'Agent Browsing', tabs: categorized.agentBrowsing },
    { label: 'Overlay', tabs: categorized.overlay },
    { label: 'Other', tabs: categorized.others },
  ]
  for (const cat of categories) {
    if (cat.tabs.length === 0) continue
    lines.push(`=== ${cat.label} (${cat.tabs.length}) ===`)
    for (const tab of cat.tabs) {
      lines.push(`  [${tab.id}] ${tab.title} — ${tab.url}`)
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'No tabs found.'
}

// ---------------------------------------------------------------------------
// Server setup & start
// ---------------------------------------------------------------------------

export async function startServer(): Promise<void> {
  logger.info('Starting MCP Comet server...')

  const server = new McpServer({
    name: 'mcp-comet',
    version: '0.1.0',
  })

  // 1. comet_connect
  server.tool(
    'comet_connect',
    'Connect to or launch the Perplexity Comet browser. Closes extra tabs and navigates to perplexity.ai.',
    connectShape,
    async ({ port }) => {
      try {
        await client.launchOrConnect(port)
        await client.closeExtraTabs()

        // Detect Comet version and load matching selectors
        const effectivePort = port ?? config.port
        const { chromeMajor, selectors } = await detectCometVersion(effectivePort)
        activeSelectors = selectors
        logger.info(`Detected Comet Chrome/${chromeMajor}, loaded selector set`)

        // Navigate to main perplexity.ai page if we landed on sidecar or non-perplexity page
        const targets = await client.listTargets()
        const currentTarget = targets.find((t) => t.id === client.state.targetId)
        const isMainPage =
          currentTarget?.url.includes('perplexity.ai') && !currentTarget?.url.includes('sidecar')
        if (!isMainPage) {
          // Try to find and connect to main page first
          const mainPage = targets.find(
            (t) =>
              t.url.includes('perplexity.ai') && !t.url.includes('sidecar') && t.type === 'page',
          )
          if (mainPage) {
            await client.disconnect()
            await client.connect(mainPage.id)
          } else {
            await client.navigate('https://www.perplexity.ai')
          }
        }
        return textResult(
          `Connected to Comet on port ${client.state.port} (Chrome/${chromeMajor}), target ${client.state.targetId}`,
        )
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 2. comet_ask
  server.tool(
    'comet_ask',
    'Send a prompt to Perplexity Comet and return immediately. Supports newChat to start fresh. Use comet_poll or comet_wait to get the response.',
    askShape,
    async ({ prompt, newChat }) => {
      try {
        if (askInProgress) return textResult('Another prompt is currently being submitted. Please wait and try again.')
        askInProgress = true
        try {
        await ensureConnected()
        const normalizedPrompt = client.normalizePrompt(prompt)
        // Handle newChat or tab management
        if (newChat) {
          await client.closeExtraTabs()
          await client.disconnect()
          await client.launchOrConnect()
          await client.navigate('https://www.perplexity.ai')
          await sleep(2000)
        } else {
          const cat = await client.listTabsCategorized()
          if (cat.main.length > 0 && cat.main[0].id !== client.state.targetId) {
            await client.disconnect()
            await client.connect(cat.main[0].id)
          }
        }

        // PRE-SEND STATE CAPTURE
        const preSendRaw = await client.safeEvaluate(buildPreSendStateScript())
        const _preSendState = JSON.parse(String(extractValue(preSendRaw))) as {
          proseCount: number
          lastProseText: string
        }

        // Type prompt
        const typeResult = await client.safeEvaluate(
          buildTypePromptScript(normalizedPrompt, activeSelectors),
        )
        logger.debug('Type result:', extractValue(typeResult))

        // Wait for React to process
        await sleep(500)

        // Submit
        const submitResult = await client.safeEvaluate(buildSubmitPromptScript())
        logger.debug('Submit result:', extractValue(submitResult))

        return textResult(
          'Prompt submitted successfully. Use comet_poll to track status or comet_wait to block until completion.',
        )
        } finally {
          askInProgress = false
        }
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 3. comet_poll
  server.tool(
    'comet_poll',
    'Poll the current agent status, steps, and response content.',
    {},
    async () => {
      try {
        await ensureConnected()
        const raw = await client.safeEvaluate(buildGetAgentStatusScript(activeSelectors))
        const status = parseAgentStatus(extractValue(raw))
        return textResult(JSON.stringify(status, null, 2))
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 4. comet_stop
  server.tool(
    'comet_stop',
    'Stop the currently running agent by clicking the stop/cancel button.',
    {},
    async () => {
      try {
        await ensureConnected()
        const script = buildStopAgentScript()
        // Retry up to 5 times — agent may not have started yet
        for (let attempt = 0; attempt < 5; attempt++) {
          const raw = await client.safeEvaluate(script)
          const result = extractValue(raw)
          if (result === 'stopped') return textResult('Agent stopped.')
          await sleep(1000)
        }
        return textResult('No stop button found.')
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 5. comet_screenshot
  server.tool(
    'comet_screenshot',
    'Take a screenshot of the current Comet browser tab (supports png and jpeg formats).',
    screenshotShape,
    async ({ format }) => {
      try {
        await ensureConnected()
        const fmt = format ?? config.screenshotFormat
        const data = await client.screenshot(fmt)
        const mimeType = fmt === 'jpeg' ? 'image/jpeg' : 'image/png'
        return {
          content: [{ type: 'image' as const, data, mimeType }],
        }
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 6. comet_mode
  server.tool(
    'comet_mode',
    'Get or switch the current Comet mode. Modes are accessed via "/" slash command in the input field. Available: standard (default), deep-research, model-council, create, learn, review, computer.',
    modeShape,
    async ({ mode }) => {
      try {
        await ensureConnected()
        if (mode === undefined || mode === null) {
          // 1. Fast URL-based check for computer mode
          const urlRaw = await client.safeEvaluate(buildReadActiveModeScript())
          const urlMode = extractValue(urlRaw)
          if (urlMode !== 'standard') {
            return textResult(`Current mode: ${urlMode}`)
          }

          // 2. Open typeahead to read active mode from menu
          // Only navigate if not already on the home page (avoid losing active conversation)
          const urlCheck = await client.safeEvaluate(`window.location.pathname`)
          const currentPath = extractValue(urlCheck)
          if (currentPath && currentPath !== '/') {
            await client.navigate('https://www.perplexity.ai')
            await sleep(2000)
          }

          let currentMode: unknown = 'standard'
          for (let attempt = 0; attempt < 5; attempt++) {
            // Focus input and type / via execCommand
            await client.safeEvaluate(`(function() {
              var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
              if (input) input.focus();
            })()`)
            await sleep(200)
            await client.safeEvaluate(`document.execCommand("insertText", false, "/")`)
            await sleep(800)

            const raw = await client.safeEvaluate(buildReadActiveModeScript())
            const result = extractValue(raw)
            if (result !== 'standard') {
              currentMode = result
              // Close typeahead
              await client.pressKey('Escape')
              break
            }
            await sleep(300)
          }

          // Close typeahead if still open
          await client.pressKey('Escape')
          return textResult(`Current mode: ${currentMode}`)
        }
        // Navigate to home page for clean input (mode typeahead only works on new chat page)
        await client.navigate('https://www.perplexity.ai')
        await sleep(2000)

        // Clear any existing text in the Lexical editor (state persists across navigations)
        const inputLenRaw = await client.safeEvaluate(`(function() {
          var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
          return input ? (input.textContent || input.innerText || '').length : 0;
        })()`)
        const inputLen = Number(extractValue(inputLenRaw)) || 0
        if (inputLen > 0) {
          // Focus editor
          await client.safeEvaluate(`(function() {
            var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
            if (input) input.focus();
          })()`)
          await sleep(100)
          // Select all content and delete via execCommand
          await client.safeEvaluate(`(function() {
            var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
            if (!input) return;
            var range = document.createRange();
            range.selectNodeContents(input);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          })()`)
          await sleep(50)
          await client.safeEvaluate(`document.execCommand('delete', false, null)`)
          await sleep(200)
          // Safety: press Backspace a few times in case selectAll missed something
          for (let i = 0; i < 5; i++) {
            await client.pressKey('Backspace')
            await sleep(20)
          }
        }

        const MAX_MODE_RETRIES = 10
        for (let attempt = 0; attempt < MAX_MODE_RETRIES; attempt++) {
          // Focus input and type / via execCommand (most reliable for Lexical)
          await client.safeEvaluate(`(function() {
            var input = document.querySelector('#ask-input') || document.querySelector('[contenteditable="true"]');
            if (input) input.focus();
          })()`)
          await sleep(200)
          await client.safeEvaluate(`document.execCommand("insertText", false, "/")`)
          await sleep(800)

          const raw = await client.safeEvaluate(buildModeSwitchScript(mode))
          const result = extractValue(raw)
          if (result !== 'no_listbox_found' && result !== 'no_input_found') {
            // Close typeahead if still open
            await client.pressKey('Escape')
            return textResult(`Mode switch result: ${result}`)
          }
          // Close typeahead and retry
          await client.pressKey('Escape')
          await sleep(300)
        }
        return textResult('Mode switch failed: typeahead menu did not appear after retries')
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 7. comet_list_tabs
  server.tool(
    'comet_list_tabs',
    'List all browser tabs categorized by role (main, sidecar, agent-browsing, overlay, other).',
    {},
    async () => {
      try {
        await ensureConnected()
        const categorized = await client.listTabsCategorized()
        return textResult(formatTabs(categorized))
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 8. comet_switch_tab
  server.tool(
    'comet_switch_tab',
    'Switch to a different browser tab by ID or title substring.',
    switchTabShape,
    async ({ tabId, title }) => {
      try {
        if (!tabId && !title) {
          return textResult('Provide at least one of tabId or title.')
        }
        await ensureConnected()
        const targets = await client.listTargets()
        let target: TabInfo | undefined

        if (tabId) {
          target = targets.find((t) => t.id === tabId)
        } else if (title) {
          target = targets.find((t) => t.title.includes(title))
        }

        if (!target) {
          const criteria = tabId ? `ID "${tabId}"` : `title containing "${title}"`
          return textResult(`Tab not found matching ${criteria}`)
        }

        await client.disconnect()
        const newTargetId = await client.connect(target.id)
        return textResult(`Switched to tab [${newTargetId}] ${target.title} — ${target.url}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 9. comet_get_sources
  server.tool(
    'comet_get_sources',
    'Extract and list the sources/citations from the current Comet response.',
    {},
    async () => {
      try {
        await ensureConnected()
        const raw = await client.safeEvaluate(buildExtractSourcesScript())
        let sources = JSON.parse(String(extractValue(raw))) as Array<{
          url: string
          title: string
        }>

        // Second pass: expand collapsed citations (empty URLs) and re-extract
        const collapsedSources = sources.filter((s) => !s.url)
        if (collapsedSources.length > 0) {
          const clickRaw = await client.safeEvaluate(buildExpandCollapsedCitationsScript())
          const clickedCount = extractValue(clickRaw)
          if (typeof clickedCount === 'number' && clickedCount > 0) {
            await sleep(500)
            const raw2 = await client.safeEvaluate(buildExtractSourcesScript())
            const expandedSources = JSON.parse(String(extractValue(raw2))) as Array<{
              url: string
              title: string
            }>
            // Merge: keep original sources with URLs, replace collapsed ones with expanded
            const withUrl = sources.filter((s) => s.url)
            const seenUrls = new Set(withUrl.map((s) => s.url))
            for (const es of expandedSources) {
              if (es.url && !seenUrls.has(es.url)) {
                withUrl.push(es)
                seenUrls.add(es.url)
              }
            }
            sources = withUrl
          }
        }

        if (sources.length === 0) {
          return textResult('No sources found on the current page.')
        }

        const lines = sources.map((s, i) => {
          const entry = `${i + 1}. ${s.title}`
          return s.url ? `${entry}\n   ${s.url}` : entry
        })
        return textResult(`Sources (${sources.length}):\n\n${lines.join('\n\n')}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 10. comet_list_conversations
  server.tool(
    'comet_list_conversations',
    'List recent conversation links visible on the page.',
    {},
    async () => {
      try {
        await ensureConnected()
        const script = buildListConversationsScript()
        const raw = await client.safeEvaluate(script)
        const conversations = JSON.parse(String(extractValue(raw))) as Array<{
          title: string
          url: string
        }>

        if (conversations.length === 0) {
          return textResult('No conversation links found on the current page.')
        }

        const lines = conversations.map((c, i) => `${i + 1}. ${c.title}\n   ${c.url}`)
        return textResult(`Conversations (${conversations.length}):\n\n${lines.join('\n\n')}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 11. comet_open_conversation
  server.tool(
    'comet_open_conversation',
    'Navigate to a specific conversation URL.',
    openConversationShape,
    async ({ url }) => {
      try {
        await ensureConnected()
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return toMcpError(new Error(`Invalid URL: "${url}"`))
        }
        if (parsed.protocol !== 'https:' || !isPerplexityDomain(parsed.hostname)) {
          return toMcpError(
            new Error(`Invalid URL: must be a https://perplexity.ai/ URL, got "${url}"`),
          )
        }
        await client.navigate(url)
        return textResult(`Navigated to: ${url}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 12. comet_get_page_content
  server.tool(
    'comet_get_page_content',
    'Extract the current page content (title and body text) up to a maximum length.',
    getPageContentShape,
    async ({ maxLength }) => {
      try {
        await ensureConnected()
        const len = (maxLength && maxLength > 0) ? maxLength : 10000
        const raw = await client.safeEvaluate(buildExtractPageContentScript(len))
        const parsed = JSON.parse(String(extractValue(raw))) as { title: string; text: string }
        return textResult(`Title: ${parsed.title}\n\n${parsed.text}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 13. comet_wait
  server.tool(
    'comet_wait',
    'Poll until the current agent finishes responding and return the full response. Use after comet_ask times out.',
    waitShape,
    async ({ timeout }) => {
      try {
        await ensureConnected()
        const effectiveTimeout = (timeout && timeout > 0) ? timeout : 120000
        const startTime = Date.now()
        let lastResponse = ''
        let stallCount = 0
        const MAX_STALL_POLLS = 10
        const collectedSteps: string[] = []

        while (Date.now() - startTime < effectiveTimeout) {
          await sleep(config.pollInterval)
          const statusRaw = await client.safeEvaluate(buildGetAgentStatusScript(activeSelectors))
          const status = parseAgentStatus(extractValue(statusRaw))

          for (const step of status.steps) {
            if (!collectedSteps.includes(step)) collectedSteps.push(step)
          }

          if (status.response && status.response.length > lastResponse.length) {
            lastResponse = status.response
            stallCount = 0
          } else if (status.response && lastResponse.length > 0) {
            stallCount++
          }

          if (stallCount >= MAX_STALL_POLLS && lastResponse) break

          // Handle permission/action prompts — break and report
          if (status.status === 'awaiting_action') {
            const parts: string[] = ['⚠️ Comet is awaiting your permission.']
            if (status.actionPrompt) parts.push(`\nPrompt: ${status.actionPrompt}`)
            if (status.actionButtons && status.actionButtons.length > 0) {
              parts.push(`\nAvailable actions: ${status.actionButtons.join(', ')}`)
            }
            parts.push('\nUse comet_approve_action to approve or cancel the action.')
            if (collectedSteps.length > 0) {
              parts.push(`\n\nSteps:\n${collectedSteps.map((s) => `  - ${s}`).join('\n')}`)
            }
            return textResult(parts.join(''))
          }

          if ((status.status === 'completed' || status.status === 'idle') && lastResponse) {
            // Wait for response to stabilize
            let settledResponse = lastResponse
            for (let settle = 0; settle < 5; settle++) {
              await sleep(1000)
              const settledRaw = await client.safeEvaluate(
                buildGetAgentStatusScript(activeSelectors),
              )
              const settledStatus = parseAgentStatus(extractValue(settledRaw))

              // Re-check for awaiting_action after stabilization
              if (settledStatus.status === 'awaiting_action') {
                const parts: string[] = ['⚠️ Comet is awaiting your permission.']
                if (settledStatus.actionPrompt) parts.push(`\nPrompt: ${settledStatus.actionPrompt}`)
                if (settledStatus.actionButtons && settledStatus.actionButtons.length > 0) {
                  parts.push(`\nAvailable actions: ${settledStatus.actionButtons.join(', ')}`)
                }
                parts.push('\nUse comet_approve_action to approve or cancel the action.')
                if (collectedSteps.length > 0) {
                  parts.push(`\n\nSteps:\n${collectedSteps.map((s) => `  - ${s}`).join('\n')}`)
                }
                return textResult(parts.join(''))
              }

              const candidate = settledStatus.response || settledResponse
              if (candidate.length <= settledResponse.length) break
              settledResponse = candidate
            }

            const parts: string[] = []
            if (settledResponse) parts.push(settledResponse)
            if (collectedSteps.length > 0) {
              parts.push(`\n\nSteps:\n${collectedSteps.map((s) => `  - ${s}`).join('\n')}`)
            }
            return textResult(parts.join('') || 'Agent completed with no visible response.')
          }
        }

        // Timeout
        const timeoutParts: string[] = ['Agent is still working after timeout.']
        if (collectedSteps.length > 0) {
          timeoutParts.push(`\nSteps so far:\n${collectedSteps.map((s) => `  - ${s}`).join('\n')}`)
        }
        if (lastResponse) timeoutParts.push(`\nPartial response:\n${lastResponse}`)
        return textResult(timeoutParts.join('\n'))
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 14. comet_approve_action
  server.tool(
    'comet_approve_action',
    'Click an action button on a Comet permission/confirmation prompt. Use after comet_wait or comet_poll returns status "awaiting_action".',
    approveActionShape,
    async ({ action }) => {
      try {
        await ensureConnected()
        const effectiveAction = action ?? 'primary'
        const raw = await client.safeEvaluate(buildClickActionButtonScript(effectiveAction))
        const result = JSON.parse(String(extractValue(raw))) as {
          clicked: boolean
          buttonText?: string
          action?: string
          error?: string
          fallback?: boolean
        }

        if (result.clicked) {
          return textResult(
            `Action ${effectiveAction === 'primary' ? 'approved' : 'cancelled'}: clicked "${result.buttonText}" button.${result.fallback ? ' (fallback: no bg-button-bg found, clicked first non-cancel button)' : ''}`,
          )
        }
        return textResult(
          `No action banner found. ${result.error || 'The agent may not be awaiting an action.'}`,
        )
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // Connect via stdio
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info('MCP Comet server connected via stdio.')

  // Signal handlers
  const shutdown = async () => {
    logger.info('Shutting down...')
    try {
      await client.disconnect()
    } catch {}
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
