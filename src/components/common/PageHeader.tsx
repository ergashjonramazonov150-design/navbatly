import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
  leading,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  leading?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-4">
      <div className="flex min-w-[200px] flex-1 items-center gap-3.5">
        {leading}
        <div className="min-w-0">
          <h1 className="text-[25px] leading-tight font-semibold tracking-tight min-[900px]:text-3xl">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-[13px] text-muted-foreground">
      {children}
    </p>
  )
}

export function LoadError({
  text,
  retryLabel,
  onRetry,
}: {
  text: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[#f0c4bf] bg-danger-soft px-4 py-4 text-destructive"
    >
      <p>{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-10 items-center rounded-full px-4 font-semibold shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-surface"
      >
        {retryLabel}
      </button>
    </div>
  )
}
