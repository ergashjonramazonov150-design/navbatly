/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import { validateEnv } from './src/lib/env-validation.ts'

/**
 * Fails `vite build` (and therefore the Vercel deployment) when the public Supabase
 * settings are missing/invalid — or when a SECRET key was pasted into a VITE_ variable.
 * A failed Vercel build keeps the previous working version live.
 */
function validateEnvOnBuild(): Plugin {
  return {
    name: 'navbatly:validate-env',
    apply: 'build',
    configResolved(config) {
      // loadEnv reads .env files AND real environment variables (how Vercel provides them)
      const env = loadEnv(config.mode, config.envDir || process.cwd(), 'VITE_')
      const problems = validateEnv(env)
      if (problems.length > 0) {
        const list = problems.map((p) => `  - ${p.variable} ${p.message}`).join('\n')
        throw new Error(
          `\n\nInvalid environment configuration — build stopped:\n${list}\n\n` +
            'Fix it in .env.local (local) or Vercel → Settings → Environment Variables.\n',
        )
      }
    },
  }
}

/**
 * Windows: a terminal opened in "c:\…" (lowercase drive, e.g. VS Code's terminal) makes
 * some paths resolve as "c:" and others as "C:". Vite then pre-bundles React TWICE and the
 * app crashes ("Invalid hook call" / "reading 'useEffect'"). Using ONE spelling — uppercase
 * drive — for the project root and the "@" alias avoids that.
 */
const upperDrive = (p: string) => p.replace(/^([a-z]):/, (_, d: string) => `${d.toUpperCase()}:`)
const ROOT = upperDrive(fileURLToPath(new URL('.', import.meta.url)))

// https://vite.dev/config/
export default defineConfig({
  root: ROOT,
  plugins: [react(), tailwindcss(), validateEnvOnBuild()],
  resolve: {
    alias: {
      '@': upperDrive(fileURLToPath(new URL('./src', import.meta.url))),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
