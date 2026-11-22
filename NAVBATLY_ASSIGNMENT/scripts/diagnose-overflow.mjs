// BUG-01 diagnosis through Playwright MCP: at which widths does the homepage scroll sideways,
// and which element sticks out?   node test-results/diagnose-overflow.mjs
// Writes test-results/overflow-diagnosis.json. Read-only (opens the public homepage only).
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { McpClient } from './mcp-client.mjs'

const BASE = process.env.QA_BASE ?? 'https://navbatly.vercel.app'
const ROOT = resolve(import.meta.dirname, '..')
const WIDTHS = [390, 600, 700, 768, 820, 900, 1024, 1100, 1180, 1280, 1440]

const mcp = await McpClient.start(
  ['--headless', '--output-dir', join(tmpdir(), 'navbatly-playwright-mcp')],
  {
    root: ROOT,
  },
)
const started = new Date().toISOString()
const rows = []
for (const width of WIDTHS) {
  await mcp.call('browser_resize', { width, height: 900 })
  await mcp.call('browser_navigate', { url: BASE + '/' })
  await mcp.call('browser_wait_for', { text: "Mijozlar o'zi", time: 20 })
  await mcp.call('browser_wait_for', { time: 1 })
  const text = await mcp.call('browser_evaluate', {
    function: `() => {
      const W = document.documentElement.clientWidth
      const culprits = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        const parentOut = el.parentElement && el.parentElement.getBoundingClientRect().right > W + 1
        if (r.width > 0 && r.right > W + 1 && !parentOut)
          culprits.push({ tag: el.tagName.toLowerCase(), className: String(el.className), right: Math.round(r.right) })
      }
      return { overflowPx: document.documentElement.scrollWidth - W, culprits }
    }`,
  })
  const result = JSON.parse(text.match(/### Result\n([\s\S]*?)(\n### |$)/)[1])
  rows.push({ width, ...result })
  console.log(
    width,
    'px →',
    result.overflowPx,
    'px',
    result.culprits.map((c) => c.className).join(' | '),
  )
}
await mcp.close()
writeFileSync(
  join(ROOT, 'test-results/overflow-diagnosis.json'),
  JSON.stringify({ base: BASE, started, finished: new Date().toISOString(), rows }, null, 2) + '\n',
)
process.exit(0)
