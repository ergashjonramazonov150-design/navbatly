// Step 1 of the QA run: prove the configured Playwright MCP server starts, completes the
// MCP handshake and exposes its browser tools.   node test-results/mcp-handshake.mjs
import { McpClient } from './mcp-client.mjs'

const client = await McpClient.start(['--headless'])
const { serverInfo, protocolVersion, capabilities } = client.serverInfo
console.log('server:', JSON.stringify(serverInfo), '| protocol:', protocolVersion)
console.log('server capabilities:', Object.keys(capabilities ?? {}).join(', '))
const { tools } = await client.request('tools/list')
console.log(`tools (${tools.length}):`)
for (const t of tools)
  console.log(` - ${t.name}: ${(t.description ?? '').split('\n')[0].slice(0, 90)}`)
await client.close()
process.exit(0)
