import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: Session; user: User }

export type AuthContextValue = {
  state: AuthState
  /** true after the user arrived from a password-reset email link */
  recovery: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
