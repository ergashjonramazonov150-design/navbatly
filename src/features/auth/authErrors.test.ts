import { describe, expect, it } from 'vitest'

import { authErrorKey } from './authErrors'

describe('authErrorKey', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'auth.invalidCredentials'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'auth.tooManyAttempts'],
    [{ code: 'email_not_confirmed' }, 'auth.emailNotConfirmed'],
    [{ code: 'email_address_not_authorized' }, 'auth.resetUnavailable'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'auth.resetUnavailable'],
    [{ code: 'weak_password' }, 'auth.weakPassword'],
    [{ code: 'same_password' }, 'auth.samePassword'],
    [{ code: 'session_expired' }, 'auth.sessionExpired'],
  ])('maps Supabase code %o → %s', (error, key) => {
    expect(authErrorKey(error)).toBe(key)
  })

  it('treats "no response from server" as a network problem', () => {
    expect(authErrorKey({ name: 'AuthRetryableFetchError', status: 0 })).toBe('auth.network')
    expect(authErrorKey(new TypeError('Failed to fetch'))).toBe('auth.network')
  })

  it('falls back to rate-limit for an unknown 429', () => {
    expect(authErrorKey({ code: 'something_new', status: 429 })).toBe('auth.tooManyAttempts')
  })

  it('never throws on odd input', () => {
    expect(authErrorKey(null)).toBe('auth.unknown')
    expect(authErrorKey('boom')).toBe('auth.unknown')
    expect(authErrorKey({ code: 'brand_new_code', status: 500 })).toBe('auth.unknown')
  })
})
