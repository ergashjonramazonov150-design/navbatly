import { describe, expect, it } from 'vitest'

import { validateEnv } from './env-validation'

const good = {
  VITE_SUPABASE_URL: 'https://qxzcsuodzpmkksgjosvn.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_AbCdEf123456789',
}
// fake legacy JWTs: header.payload.signature with {"role": ...}
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role }))}.sig`
const vars = (env: Parameters<typeof validateEnv>[0]) => validateEnv(env).map((p) => p.variable)

describe('validateEnv', () => {
  it('accepts a correct project URL + publishable key', () => {
    expect(validateEnv(good)).toEqual([])
  })

  it('accepts a local Supabase URL for development', () => {
    expect(validateEnv({ ...good, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toEqual([])
  })

  it('accepts a legacy anon JWT key', () => {
    expect(validateEnv({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') })).toEqual([])
  })

  it('reports both variables when missing', () => {
    expect(vars({})).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
  })

  it('catches the real incident: ".env.local" typed as the value', () => {
    const problems = validateEnv({
      VITE_SUPABASE_URL: '.env.local',
      VITE_SUPABASE_PUBLISHABLE_KEY: '.env.local',
    })
    expect(problems.map((p) => p.variable)).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ])
    expect(problems[0].message).toContain('not a valid URL')
  })

  it('rejects http:// and non-Supabase hosts', () => {
    expect(vars({ ...good, VITE_SUPABASE_URL: 'http://abc.supabase.co' })).toEqual([
      'VITE_SUPABASE_URL',
    ])
    expect(vars({ ...good, VITE_SUPABASE_URL: 'https://example.com' })).toEqual([
      'VITE_SUPABASE_URL',
    ])
  })

  it('BLOCKS a secret key pasted into the public variable', () => {
    const [p] = validateEnv({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc123456789' })
    expect(p.message).toContain('SECRET')
  })

  it('BLOCKS a legacy service_role JWT', () => {
    const [p] = validateEnv({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('service_role') })
    expect(p.message).toContain('service_role')
  })

  it('trims accidental spaces instead of failing', () => {
    expect(
      validateEnv({
        VITE_SUPABASE_URL: `  ${good.VITE_SUPABASE_URL} `,
        VITE_SUPABASE_PUBLISHABLE_KEY: ` ${good.VITE_SUPABASE_PUBLISHABLE_KEY}\n`,
      }),
    ).toEqual([])
  })
})
