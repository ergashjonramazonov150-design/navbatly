import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

/**
 * Keeps track of the Supabase login session for the whole app.
 * The session is stored by supabase-js (localStorage), so it survives page reloads.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true

    // Initial session (also processes a password-reset link in the URL, if any)
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState(
        data.session
          ? { status: 'signedIn', session: data.session, user: data.session.user }
          : { status: 'signedOut' },
      )
    })

    // Later changes: sign in, sign out, token refresh, password recovery.
    // Keep this callback synchronous — Supabase recommends not awaiting inside it.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setState(
        session ? { status: 'signedIn', session, user: session.user } : { status: 'signedOut' },
      )
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Drop every cached query so the next user never sees the previous user's data
    queryClient.clear()
    setRecovery(false)
  }, [queryClient])

  const value = useMemo(() => ({ state, recovery, signOut }), [state, recovery, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
