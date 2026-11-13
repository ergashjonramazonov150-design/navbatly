import { cn } from 'cn'

import { initials } from '@/lib/initials'

/** Fallback avatar (first letters of the name) until photos arrive (M3.5). */
export function InitialsAvatar({
  name,
  className,
  active = true,
}: {
  name: string
  className?: string
  active?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-full font-heading text-lg font-bold',
        active ? 'bg-[#e9d8c4] text-[#7a3d1e]' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
