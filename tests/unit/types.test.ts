import { describe, expect, it } from 'vitest'
import {
  AgentState,
  type AgentStatus,
  type CometConfig,
  TabCategory,
  type TabInfo,
} from '../../src/types.js'

describe('AgentState', () => {
  it('has all expected states', () => {
    expect(AgentState.Idle).toBe('idle')
    expect(AgentState.Thinking).toBe('thinking')
    expect(AgentState.Searching).toBe('searching')
    expect(AgentState.Responding).toBe('responding')
    expect(AgentState.Completed).toBe('completed')
    expect(AgentState.Error).toBe('error')
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

describe('AgentStatus', () => {
  it('accepts valid shape', () => {
    const status: AgentStatus = {
      state: AgentState.Idle,
      steps: [],
      currentStep: '',
      response: '',
      hasStopButton: false,
      agentBrowsingUrl: '',
    }
    expect(status.state).toBe('idle')
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
      maxReconnectAttempts: 5,
      maxReconnectDelay: 5000,
      pollInterval: 1000,
    }
    expect(config.port).toBe(9222)
  })
})
