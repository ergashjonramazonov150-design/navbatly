import { useEffect, useRef } from 'react'

import { TURNSTILE_SITE_KEY } from '@/lib/env'

/*
 * Cloudflare Turnstile ("Siz robot emassiz") for WEB bookings (M7). Not used inside
 * Telegram — there Telegram-signed initData proves a real user. Switched on only when
 * VITE_TURNSTILE_SITE_KEY is set (Vercel → Environment Variables); the server side checks
 * the token only when TURNSTILE_SECRET_KEY is set (Supabase → Edge Functions → Secrets).
 */

type TurnstileApi = {
  render(el: HTMLElement, opts: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi | null> | null = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve(window.turnstile ?? null)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Renders the widget and reports the one-time token (null when expired / reset).
 * `resetKey`: change it to get a fresh token (a token works only once — after every
 * booking attempt the page asks for a new one).
 */
export function Turnstile({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void
  resetKey: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const cb = useRef(onToken)
  useEffect(() => {
    cb.current = onToken
  }, [onToken])

  useEffect(() => {
    let cancelled = false
    void loadTurnstile().then((api) => {
      if (!api || cancelled || !box.current || id.current) return
      id.current = api.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        language: 'auto',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      })
    })
    return () => {
      cancelled = true
      if (id.current) window.turnstile?.remove(id.current)
      id.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey && id.current) {
      cb.current(null)
      window.turnstile?.reset(id.current)
    }
  }, [resetKey])

  return <div ref={box} className="min-h-[65px]" />
}
