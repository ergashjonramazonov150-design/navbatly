#!/usr/bin/env node
/**
 * Serves the production build (dist/) locally WITH the headers from vercel.json, so a new
 * Content-Security-Policy can be checked before deploying:
 *   npx vite build && node scripts/serve-dist.mjs 4173
 *   npm run check:live -- http://localhost:4173
 * Vercel "source" patterns used here are plain regex groups, so they work as JS regexes.
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const port = Number(process.argv[2] ?? 4173)
const root = 'dist'
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  for (const rule of cfg.headers ?? []) {
    if (new RegExp(`^${rule.source}$`).test(path)) {
      for (const h of rule.headers) res.setHeader(h.key, h.value)
    }
  }
  let file = normalize(join(root, path))
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, 'index.html') // SPA rewrite, like vercel.json
  }
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(port, () =>
  console.log(`serving dist with vercel.json headers on http://localhost:${port}`),
)
