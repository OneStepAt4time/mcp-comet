import { describe, expect, it } from 'vitest'
import {
  type AgentStatus,
  type AgentStatusValue,
  type CometConfig,
  TabCategory,
  type TabInfo,
} from '../../src/types.js'

describe('AgentStatusValue', () => {
  it('accepts all valid status values', () => {
    const values: AgentStatusValue[] = ['idle', 'working', 'completed', 'awaiting_action']
    expect(values).toHaveLength(4)
  })
})

describe('AgentStatus', () => {
  it('accepts valid shape with required fields', () => {
    const status: AgentStatus = {
      status: 'working',
      steps: ['step 1'],
      currentStep: 'step 2',
      response: 'text',
      hasStopButton: true,
    }
    expect(status.status).toBe('working')
  })

  it('accepts optional fields', () => {
    const status: AgentStatus = {
      status: 'awaiting_action',
      steps: [],
      currentStep: '',
      response: '',
      hasStopButton: false,
      hasLoadingSpinner: true,
      proseCount: 3,
      actionPrompt: 'Create issue?',
      actionButtons: ['Create', 'Cancel'],
    }
    expect(status.actionPrompt).toBe('Create issue?')
    expect(status.actionButtons).toEqual(['Create', 'Cancel'])
  })
})

describe('TabCategory', () => {
  it('has all expected categories', () => {
    expect(TabCategory.Main).toBe('main')
    expect(TabCategory.Sidecar).toBe('sidecar')
    expect(TabCategory.AgentBrowsing).toBe('agentBrowsing')
    expect(TabCategory.Overlay).toBe('overlay')
    expect(TabCategory.Other).toBe('other')
  })
})

describe('TabInfo', () => {
  it('accepts valid shape', () => {
    const tab: TabInfo = {
      id: 'ABC123',
      type: 'page',
      title: 'Perplexity',
      url: 'https://www.perplexity.ai',
      category: TabCategory.Main,
    }
    expect(tab.category).toBe('main')
  })
})

describe('CometConfig', () => {
  it('accepts valid shape', () => {
    const config: CometConfig = {
      port: 9222,
      timeout: 30000,
      cometPath: null,
      responseTimeout: 120000,
      logLevel: 'info',
      screenshotFormat: 'png',
      screenshotQuality: 80,
      windowWidth: 1440,
      windowHeight: 900,
      overrideViewport: false,
      maxReconnectAttempts: 5,
      maxReconnectDelay: 5000,
      pollInterval: 1000,
      userDataDir: null,
    }
    expect(config.port).toBe(9222)
    expect(config.overrideViewport).toBe(false)
  })
})
