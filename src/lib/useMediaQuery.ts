import { useSyncExternalStore } from 'react'

/** true while the CSS media query matches (false where matchMedia is missing, e.g. tests). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia?.(query).matches) || false,
    () => false,
  )
}
