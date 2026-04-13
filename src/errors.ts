export class CometError extends Error {
  code: string
  context: Record<string, unknown>
  override cause?: unknown

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    cause?: unknown,
  ) {
    super(message)
    this.name = 'CometError'
    this.code = code
    this.context = context
    if (cause) this.cause = cause
  }
}

export class CDPConnectionError extends CometError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, 'CDP_CONNECTION_FAILED', context, cause)
    this.name = 'CDPConnectionError'
  }
}

export class CometNotFoundError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'COMET_NOT_FOUND', context)
    this.name = 'CometNotFoundError'
  }
}

export class CometLaunchError extends CometError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, 'COMET_LAUNCH_FAILED', context, cause)
    this.name = 'CometLaunchError'
  }
}

export class TabNotFoundError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TAB_NOT_FOUND', context)
    this.name = 'TabNotFoundError'
  }
}

export class TimeoutError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TIMEOUT', context)
    this.name = 'TimeoutError'
  }
}

export class EvaluationError extends CometError {
  constructor(message: string, context?: Record<string, unknown>, cause?: unknown) {
    super(message, 'EVALUATION_FAILED', context, cause)
    this.name = 'EvaluationError'
  }
}

export class SelectorError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SELECTOR_NOT_FOUND', context)
    this.name = 'SelectorError'
  }
}

export class AgentError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AGENT_ERROR', context)
    this.name = 'AgentError'
  }
}

export class ConfigurationError extends CometError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', context)
    this.name = 'ConfigurationError'
  }
}

export function toMcpError(err: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
} {
  if (err instanceof CometError) {
    return {
      content: [{ type: 'text', text: `[${err.code}] ${err.message}` }],
      isError: true,
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  return {
    content: [{ type: 'text', text: `Error: ${msg}` }],
    isError: true,
  }
}
