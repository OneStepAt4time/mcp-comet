import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { CDPClient } from './cdp/client.js'
import { loadConfig } from './config.js'
import { EvaluationError, toMcpError } from './errors.js'
import { createLogger } from './logger.js'
import { buildPreSendStateScript } from './prose-filter.js'
import type { SelectorSet } from './selectors/types.js'
import type { CategorizedTabs, TabInfo } from './types.js'
import { buildExtractPageContentScript, buildExtractSourcesScript } from './ui/extraction.js'
import { buildTypePromptScript } from './ui/input.js'
import {
  buildGetCurrentModeScript,
  buildModeSwitchScript,
  buildSubmitPromptScript,
} from './ui/navigation.js'
import { SELECTORS } from './ui/selectors.js'
import { buildGetAgentStatusScript } from './ui/status.js'
import { buildStopAgentScript } from './ui/stop.js'
import { buildListConversationsScript } from './ui/conversations.js'
import { detectCometVersion } from './version.js'

// ---------------------------------------------------------------------------
// Configuration & singletons
// ---------------------------------------------------------------------------

const config = loadConfig()
const logger = createLogger(config.logLevel)
const client = CDPClient.getInstance(config)

/** Active selector set — updated after each comet_connect to match Comet's Chrome version. */
let activeSelectors: SelectorSet = SELECTORS

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
  prompt: z.string().describe('The question or instruction to send to Perplexity Comet'),
  newChat: z.boolean().optional().describe('Start a fresh chat before sending the prompt'),
  timeout: z.number().optional().describe('Maximum wait time in ms for the agent response'),
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
      'Send a prompt to Perplexity Comet and poll until the agent responds or times out. Supports newChat to start fresh.',
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

/** Runtime shape returned by buildGetAgentStatusScript(). */
interface RawAgentStatus {
  status: string
  steps: string[]
  currentStep: string
  response: string
  hasStopButton: boolean
  hasLoadingSpinner?: boolean
  proseCount?: number
}

function parseAgentStatus(raw: unknown): RawAgentStatus {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RawAgentStatus
    } catch {
      return { status: 'idle', steps: [], currentStep: '', response: '', hasStopButton: false, proseCount: 0 }
    }
  }
  return raw as RawAgentStatus
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

/** Heuristic: does the status contain a substantial response? */
function hasSubstantialResponse(status: RawAgentStatus): boolean {
  return !!status.response && status.response.length > 50
}

// ---------------------------------------------------------------------------
// Server setup & start
// ---------------------------------------------------------------------------

export async function startServer(): Promise<void> {
  logger.info('Starting Asteria MCP server...')

  const server = new McpServer({
    name: 'asteria',
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
    'Send a prompt to Perplexity Comet and poll until the agent responds or times out. Supports newChat to start fresh.',
    askShape,
    async ({ prompt, newChat, timeout }) => {
      try {
        const normalizedPrompt = client.normalizePrompt(prompt)
        const effectiveTimeout = timeout ?? config.responseTimeout

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
        const preSendState = JSON.parse(String(extractValue(preSendRaw))) as {
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

        // POLLING LOOP
        const startTime = Date.now()
        let sawNewResponse = false
        let timedOut = false
        const collectedSteps: string[] = []
        let lastResponse = ''

        while (!timedOut && Date.now() - startTime < effectiveTimeout) {
          await sleep(config.pollInterval)

          const statusRaw = await client.safeEvaluate(buildGetAgentStatusScript(activeSelectors))
          const status = parseAgentStatus(extractValue(statusRaw))

          // Collect new steps
          for (const step of status.steps) {
            if (!collectedSteps.includes(step)) {
              collectedSteps.push(step)
            }
          }

          // Check for new response — proseCount is the primary signal
          const proseIncreased =
            (status.proseCount ?? 0) > preSendState.proseCount
          const responseChanged =
            proseIncreased ||
            status.response !== preSendState.lastProseText ||
            hasSubstantialResponse(status)

          if (responseChanged && status.response) {
            sawNewResponse = true
            lastResponse = status.response
          }

          if ((status.status === 'completed' || status.status === 'idle') && sawNewResponse) {
            const parts: string[] = []
            if (lastResponse) parts.push(lastResponse)
            if (collectedSteps.length > 0) {
              parts.push(`\n\nSteps:\n${collectedSteps.map((s) => `  - ${s}`).join('\n')}`)
            }
            return textResult(parts.join('') || 'Agent completed with no visible response.')
          }

          if (status.status === 'idle' && !sawNewResponse && status.response) {
            return textResult(status.response)
          }
        }

        // Mark timed out to prevent any further polling
        timedOut = true

        // Timeout
        const timeoutParts: string[] = ['Agent is still working. Use comet_poll to check status.']
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

  // 3. comet_poll
  server.tool(
    'comet_poll',
    'Poll the current agent status, steps, and response content.',
    {},
    async () => {
      try {
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
        const script = buildStopAgentScript()
        const raw = await client.safeEvaluate(script)
        const result = extractValue(raw)
        return textResult(result === 'stopped' ? 'Agent stopped.' : 'No stop button found.')
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // 5. comet_screenshot
  server.tool(
    'comet_screenshot',
    'Take a screenshot of the current Comet browser tab.',
    screenshotShape,
    async ({ format }) => {
      try {
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
        if (mode === undefined || mode === null) {
          const raw = await client.safeEvaluate(buildGetCurrentModeScript())
          const currentMode = extractValue(raw)
          return textResult(`Current mode: ${currentMode}`)
        }
        const raw = await client.safeEvaluate(buildModeSwitchScript(mode))
        const result = extractValue(raw)
        return textResult(`Mode switch result: ${result}`)
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
        const raw = await client.safeEvaluate(buildExtractSourcesScript())
        const sources = JSON.parse(String(extractValue(raw))) as Array<{
          url: string
          title: string
        }>

        if (sources.length === 0) {
          return textResult('No sources found on the current page.')
        }

        const lines = sources.map((s, i) => `${i + 1}. ${s.title}\n   ${s.url}`)
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
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return toMcpError(new Error(`Invalid URL: "${url}"`))
        }
        if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('perplexity.ai')) {
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
        const len = maxLength ?? 10000
        const raw = await client.safeEvaluate(buildExtractPageContentScript(len))
        const parsed = JSON.parse(String(extractValue(raw))) as { title: string; text: string }
        return textResult(`Title: ${parsed.title}\n\n${parsed.text}`)
      } catch (err) {
        return toMcpError(err)
      }
    },
  )

  // Connect via stdio
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info('Asteria MCP server connected via stdio.')

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
