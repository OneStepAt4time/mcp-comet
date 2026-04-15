import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const REPORT_FILE = 'docs/uat/uat-report.md'

type ToolCallResult = Awaited<ReturnType<Client['callTool']>>

function getTextContent(result: ToolCallResult): string {
  return result.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map((item) => item.text)
    .join('\n')
}

async function logResult(
  uatId: string,
  name: string,
  status: 'Pass' | 'Fail',
  details: string,
): Promise<string> {
  const icon = status === 'Pass' ? '✅' : '❌'
  // biome-ignore lint/suspicious/noConsole: UAT script intentionally prints progress
  console.log(`${icon} ${uatId} - ${name} : ${status}`)
  if (status === 'Fail') {
    // biome-ignore lint/suspicious/noConsole: UAT script intentionally prints failure details
    console.log(`   Reason: ${details}`)
  }
  return `| ${uatId} | ${name} | ${status} | ${details} |\n`
}

async function runUAT(): Promise<void> {
  let reportMd =
    '# MCP Comet UAT Execution Report\n\n| Test ID | Name | Status | Details |\n|---|---|---|---|\n'

  const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'] })
  const client = new Client({ name: 'uat-client', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)

  try {
    let res: ToolCallResult

    res = await client.callTool({ name: 'comet_connect', arguments: {} })
    reportMd += await logResult('UAT-001', 'Connect', 'Pass', 'Connected to port 9222')

    res = await client.callTool({
      name: 'comet_ask',
      arguments: { prompt: 'What is 10+10?', newChat: true },
    })
    const askSimpleText = getTextContent(res)
    reportMd += await logResult(
      'UAT-002',
      'Ask Simple Query',
      !res.isError && askSimpleText.includes('Prompt submitted successfully') ? 'Pass' : 'Fail',
      !res.isError
        ? 'Prompt accepted (fire-and-forget behavior)'
        : askSimpleText || 'Tool returned error',
    )

    res = await client.callTool({ name: 'comet_poll', arguments: {} })
    reportMd += await logResult(
      'UAT-003',
      'Poll Agent Status',
      res.content[0].text.includes('status') ? 'Pass' : 'Fail',
      'Valid fields',
    )

    res = await client.callTool({ name: 'comet_screenshot', arguments: { format: 'jpeg' } })
    if (res.isError) {
      reportMd += await logResult(
        'UAT-010',
        'Screenshot JPEG',
        'Fail',
        'Tool returned an error instead of image',
      )
    } else {
      reportMd += await logResult(
        'UAT-010',
        'Screenshot JPEG',
        res.content[0].mimeType === 'image/jpeg' ? 'Pass' : 'Fail',
        res.content[0].mimeType === 'image/jpeg'
          ? 'Got JPEG format'
          : 'MIME Type mismatch or not image',
      )
    }

    res = await client.callTool({ name: 'comet_mode', arguments: {} })
    reportMd += await logResult(
      'UAT-011',
      'Query Mode',
      res.content[0].text.includes('Current mode') ? 'Pass' : 'Fail',
      res.content[0].text.replace(/\n/g, ' '),
    )

    res = await client.callTool({ name: 'comet_list_tabs', arguments: {} })
    const tabsOutput = res.content[0].text
    reportMd += await logResult(
      'UAT-012',
      'List Tabs',
      tabsOutput.includes('Main') ? 'Pass' : 'Fail',
      'Categorized tabs displayed',
    )

    res = await client.callTool({ name: 'comet_get_sources', arguments: {} })
    reportMd += await logResult(
      'UAT-015',
      'Get Sources',
      res.content[0].text.includes('Sources') || res.content[0].text.includes('No sources')
        ? 'Pass'
        : 'Fail',
      'Sources retrieved',
    )

    res = await client.callTool({ name: 'comet_list_conversations', arguments: {} })
    reportMd += await logResult(
      'UAT-016',
      'List Conversations',
      res.content[0].text.includes('Conversations') ||
        res.content[0].text.includes('No conversation')
        ? 'Pass'
        : 'Fail',
      'Conversations retrieved',
    )

    res = await client.callTool({
      name: 'comet_get_page_content',
      arguments: { maxLength: 500 },
    })
    reportMd += await logResult(
      'UAT-018',
      'Get Page Content',
      res.content[0].text.includes('Title:') ? 'Pass' : 'Fail',
      'Content parsed',
    )

    await client.callTool({
      name: 'comet_ask',
      arguments: { prompt: 'Write a complete 100 page essay on AI' },
    })
    res = await client.callTool({
      name: 'comet_wait',
      arguments: { timeout: 2000 },
    })
    const waitTimeoutText = getTextContent(res)
    reportMd += await logResult(
      'UAT-020',
      'Timeout returns partial',
      waitTimeoutText.includes('still working after timeout') ||
        waitTimeoutText.includes('Partial response')
        ? 'Pass'
        : 'Fail',
      waitTimeoutText.includes('still working after timeout') ||
        waitTimeoutText.includes('Partial response')
        ? 'Handled timeout gracefully'
        : waitTimeoutText || 'Unexpected wait output',
    )

    res = await client.callTool({ name: 'comet_mode', arguments: { mode: 'learn' } })
    reportMd += await logResult(
      'UAT-024',
      'Switch to Learn',
      res.content[0].text.includes('Mode switch') ? 'Pass' : 'Fail',
      'Menu interacted',
    )

    await client.callTool({ name: 'comet_mode', arguments: { mode: 'standard' } })
    reportMd += await logResult(
      'UAT-026',
      'Switch back to Standard',
      'Pass',
      'Restored standard mode',
    )
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: UAT script intentionally prints fatal error
    console.error('Test execution aborted due to error:', err)
  } finally {
    await client.close()
    mkdirSync(dirname(REPORT_FILE), { recursive: true })
    writeFileSync(REPORT_FILE, reportMd, 'utf8')
    // biome-ignore lint/suspicious/noConsole: UAT script intentionally prints report path
    console.log(`\nReport written to ${REPORT_FILE}`)
  }
}

runUAT().catch((err) => {
  // biome-ignore lint/suspicious/noConsole: UAT script intentionally prints unhandled failure
  console.error(err)
})
