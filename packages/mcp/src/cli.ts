#!/usr/bin/env bun
import os from 'node:os'
import path from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTemandorMcpServer } from './server'

async function main() {
  const dir = process.env.TEMANDOR_DIR || path.join(os.homedir(), 'Temandor')
  const server = createTemandorMcpServer(dir)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err)
  process.stderr.write(`Temandor MCP gagal dijalankan: ${msg}\n`)
  process.exit(1)
})
