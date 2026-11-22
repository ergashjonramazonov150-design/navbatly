// Minimal MCP client (stdio transport, JSON-RPC 2.0) — no extra dependencies.
// It starts the "playwright" server EXACTLY as configured in .mcp.json and talks to it the
// same way an MCP host (Claude Code, VS Code, Claude Desktop) does:
//   initialize → notifications/initialized → tools/list → tools/call …
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export class McpClient {
  #proc
  #nextId = 1
  #pending = new Map()
  #buffer = ''
  serverInfo = null
  log = [] // every request/response pair (for the report)

  /** @param {string[]} extraArgs extra CLI options appended to the configured ones */
  static async start(extraArgs = [], { root = process.cwd() } = {}) {
    const cfg = JSON.parse(readFileSync(resolve(root, '.mcp.json'), 'utf8')).mcpServers.playwright
    const client = new McpClient()
    client.#proc = spawn(cfg.command, [...cfg.args, ...extraArgs], {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    client.#proc.stdout.setEncoding('utf8')
    client.#proc.stdout.on('data', (chunk) => client.#onData(chunk))
    client.#proc.stderr.on('data', () => {}) // server diagnostics are not protocol messages
    const init = await client.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'navbatly-qa-client', version: '1.0.0' },
    })
    client.serverInfo = init
    client.notify('notifications/initialized')
    return client
  }

  #onData(chunk) {
    this.#buffer += chunk
    let nl
    while ((nl = this.#buffer.indexOf('\n')) >= 0) {
      const line = this.#buffer.slice(0, nl).trim()
      this.#buffer = this.#buffer.slice(nl + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.id !== undefined && this.#pending.has(msg.id)) {
        const { resolve: ok, reject } = this.#pending.get(msg.id)
        this.#pending.delete(msg.id)
        if (msg.error) reject(new Error(`${msg.error.code}: ${msg.error.message}`))
        else ok(msg.result)
      } else if (msg.method && msg.id !== undefined) {
        // a request FROM the server (e.g. roots/list) — we declared no capabilities
        this.#send({
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32601, message: 'not supported' },
        })
      }
    }
  }

  #send(msg) {
    this.#proc.stdin.write(JSON.stringify(msg) + '\n')
  }

  request(method, params = {}, timeoutMs = 120_000) {
    const id = this.#nextId++
    return new Promise((ok, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new Error(`timeout: ${method}`))
      }, timeoutMs)
      this.#pending.set(id, {
        resolve: (r) => (clearTimeout(timer), ok(r)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      })
      this.#send({ jsonrpc: '2.0', id, method, params })
    })
  }

  notify(method, params = {}) {
    this.#send({ jsonrpc: '2.0', method, params })
  }

  /** tools/call → the text parts of the result joined together */
  async call(name, args = {}) {
    const result = await this.request('tools/call', { name, arguments: args })
    const text = (result.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
    this.log.push({ tool: name, args, isError: !!result.isError, text })
    if (result.isError) throw new Error(`${name} failed: ${text.slice(0, 500)}`)
    return text
  }

  async close() {
    try {
      await this.call('browser_close')
    } catch {
      /* already closed */
    }
    this.#proc.stdin.end()
    this.#proc.kill()
  }
}
