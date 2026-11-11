/**
 * Validates the PUBLIC Supabase settings. Pure function (no `import.meta`), so it runs both:
 *   - in vite.config.ts at BUILD time → a bad value fails the Vercel build (old site stays live)
 *   - in the browser at START-UP     → a clear error screen instead of a blank page (dev, previews)
 *
 * Also blocks the most dangerous mistake: pasting the SECRET key into a VITE_ variable,
 * which would publish it to every visitor.
 */
export type EnvInput = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export type EnvProblem = {
  variable: keyof EnvInput
  /** short English explanation for developers (build log / error screen) */
  message: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

export function validateEnv(env: EnvInput): EnvProblem[] {
  const problems: EnvProblem[] = []
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

  // ---- URL ----
  if (!url) {
    problems.push({ variable: 'VITE_SUPABASE_URL', message: 'is missing.' })
  } else {
    let parsed: URL | null = null
    try {
      parsed = new URL(url)
    } catch {
      problems.push({
        variable: 'VITE_SUPABASE_URL',
        message: `is not a valid URL (got "${url.slice(0, 40)}"). Expected https://<project-ref>.supabase.co`,
      })
    }
    if (parsed) {
      const local = LOCAL_HOSTS.has(parsed.hostname)
      if (!local && parsed.protocol !== 'https:') {
        problems.push({ variable: 'VITE_SUPABASE_URL', message: 'must start with https://' })
      } else if (!local && !parsed.hostname.endsWith('.supabase.co')) {
        problems.push({
          variable: 'VITE_SUPABASE_URL',
          message: `host "${parsed.hostname}" is not a Supabase project (expected *.supabase.co).`,
        })
      }
    }
  }

  // ---- Publishable (anon) key ----
  if (!key) {
    problems.push({ variable: 'VITE_SUPABASE_PUBLISHABLE_KEY', message: 'is missing.' })
  } else if (key.startsWith('sb_secret_')) {
    problems.push({
      variable: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      message:
        'contains a SECRET key (sb_secret_…). Never put it in a VITE_ variable — it would be public. Use the publishable key and rotate the secret key now.',
    })
  } else if (key.startsWith('eyJ')) {
    // legacy JWT keys: anon is fine, service_role is a leaked secret
    const role = decodeJwtRole(key)
    if (role === 'service_role') {
      problems.push({
        variable: 'VITE_SUPABASE_PUBLISHABLE_KEY',
        message:
          'is the legacy service_role (SECRET) key. Use the anon/publishable key and rotate the service_role key now.',
      })
    } else if (role !== 'anon') {
      problems.push({
        variable: 'VITE_SUPABASE_PUBLISHABLE_KEY',
        message: 'is not a valid Supabase anon key.',
      })
    }
  } else if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) {
    problems.push({
      variable: 'VITE_SUPABASE_PUBLISHABLE_KEY',
      message: `does not look like a publishable key (expected sb_publishable_…, got "${key.slice(0, 12)}…").`,
    })
  }

  return problems
}
