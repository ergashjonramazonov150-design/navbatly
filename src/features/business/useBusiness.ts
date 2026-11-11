import { useContext } from 'react'

import { BusinessContext, type BusinessContextValue } from './business-context'

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used inside <BusinessProvider>')
  return ctx
}

/** For components rendered only after the guard let the user in (status === 'ready'). */
export function useReadyBusiness() {
  const ctx = useBusiness()
  if (ctx.status !== 'ready') throw new Error('useReadyBusiness used before business was ready')
  return ctx
}
