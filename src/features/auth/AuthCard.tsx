import type { ReactNode } from 'react'

import { Logo } from '@/components/common/Logo'

/** Layout shared by login / forgot-password / reset-password pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(1200px_500px_at_50%_-10%,#efe3d3,var(--background))] px-4 py-8">
      <div className="w-full max-w-[400px] rounded-3xl border-[1.5px] border-border bg-surface px-6 py-7 shadow-[0_30px_60px_rgba(31,27,22,0.08)]">
        <Logo className="mb-5 size-12 text-xl" />
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 mb-6 text-muted-foreground">{subtitle}</p>}
        {children}
        {footer && (
          <div className="mt-5 text-center text-[12.5px] text-muted-foreground">{footer}</div>
        )}
      </div>
    </main>
  )
}
