/**
 * Public configuration read from VITE_* environment variables.
 * Everything here ends up in the browser — never put secrets in VITE_ variables.
 */
import { validateEnv } from './env-validation'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

/** Empty when the configuration is usable. main.tsx shows an error screen otherwise. */
export const ENV_PROBLEMS = validateEnv({
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
})

/**
 * VITE_PASSWORD_RESET_ENABLED — keep "false" until custom SMTP + a domain exist (M9).
 * Supabase's built-in email only delivers to the project's team members and has a tiny
 * hourly limit, so real owners would never receive the reset link.
 */
export const PASSWORD_RESET_ENABLED = import.meta.env.VITE_PASSWORD_RESET_ENABLED === 'true'
