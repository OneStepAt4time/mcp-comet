#!/usr/bin/env node
import { startServer } from './server.js'

startServer().catch((_err) => {
  process.exit(1)
})
