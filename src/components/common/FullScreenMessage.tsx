import { Loader2Icon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Logo } from './Logo'

/** Centered card used for loading, "no salon", "account inactive" and load errors. */
export function FullScreenMessage({
  title,
  children,
  actions,
  tone = 'neutral',
}: {
  title: string
  children?: ReactNode
  actions?: ReactNode
  tone?: 'neutral' | 'warning'
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div
        role={tone === 'warning' ? 'alert' : undefined}
        className="w-full max-w-md rounded-3xl border-[1.5px] border-border bg-surface p-7 shadow-[0_30px_60px_rgba(31,27,22,0.08)]"
      >
        <Logo className="mb-5 size-12 text-xl" />
        <h1 className="text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
        {children && <div className="mt-2 text-muted-foreground">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </main>
  )
}

export function FullScreenLoader({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background" aria-busy="true">
      <div className="flex items-center gap-3 text-muted-foreground" role="status">
        <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
        {label}
      </div>
    </main>
  )
}
