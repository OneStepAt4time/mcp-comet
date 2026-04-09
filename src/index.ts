#!/usr/bin/env node
import { createLogger } from './logger.js'

const logger = createLogger('info')

import('./server.js')
  .then(({ startServer }) => startServer())
  .catch((err: unknown) => {
    logger.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
