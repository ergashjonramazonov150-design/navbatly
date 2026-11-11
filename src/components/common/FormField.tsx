import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'

/** Label + control + translated error message, wired for screen readers. */
export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  /** already-translated message */
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13.5px] font-semibold">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[#f0c4bf] bg-danger-soft px-3.5 py-3 text-sm text-destructive"
    >
      {children}
    </div>
  )
}
