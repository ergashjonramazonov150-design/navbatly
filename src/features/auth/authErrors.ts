/**
 * Turns a Supabase Auth error into a translation key in errors.json ("auth.*").
 * Supabase sends machine-readable `code`s; we never show its English messages to users.
 * Codes: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export type AuthErrorKey =
  | 'auth.invalidCredentials'
  | 'auth.tooManyAttempts'
  | 'auth.emailNotConfirmed'
  | 'auth.resetUnavailable'
  | 'auth.weakPassword'
  | 'auth.samePassword'
  | 'auth.sessionExpired'
  | 'auth.network'
  | 'auth.unknown'

type ErrorLike = { code?: unknown; status?: unknown; name?: unknown }

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'auth.invalidCredentials',
  over_request_rate_limit: 'auth.tooManyAttempts',
  email_not_confirmed: 'auth.emailNotConfirmed',
  // built-in email: recipient isn't a team member / hourly limit reached (see env.ts)
  email_address_not_authorized: 'auth.resetUnavailable',
  over_email_send_rate_limit: 'auth.resetUnavailable',
  weak_password: 'auth.weakPassword',
  same_password: 'auth.samePassword',
  session_not_found: 'auth.sessionExpired',
  session_expired: 'auth.sessionExpired',
  refresh_token_not_found: 'auth.sessionExpired',
}

export function authErrorKey(error: unknown): AuthErrorKey {
  if (!error || typeof error !== 'object') return 'auth.unknown'
  const e = error as ErrorLike

  if (typeof e.code === 'string' && e.code in BY_CODE) return BY_CODE[e.code]

  // No response from the server (offline, DNS, CORS, timeout)
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || error instanceof TypeError) {
    return 'auth.network'
  }
  if (e.status === 429) return 'auth.tooManyAttempts'
  return 'auth.unknown'
}
