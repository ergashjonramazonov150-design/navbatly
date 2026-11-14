import { cn } from 'cn'

import { initials } from '@/lib/initials'

/**
 * Round avatar: the photo when there is one (M3.5), otherwise the first letters of the name.
 * Decorative (the name is always written next to it), so it is hidden from screen readers.
 */
export function InitialsAvatar({
  name,
  className,
  active = true,
  photoUrl,
}: {
  name: string
  className?: string
  active?: boolean
  /** small (`sm`) photo link; null/undefined → initials */
  photoUrl?: string | null
}) {
  const base = 'grid size-12 shrink-0 place-items-center overflow-hidden rounded-full'
  if (photoUrl) {
    return (
      <span aria-hidden="true" className={cn(base, 'bg-muted', className)}>
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className={cn('size-full object-cover', !active && 'opacity-60 grayscale')}
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        'font-heading text-lg font-bold',
        active ? 'bg-[#e9d8c4] text-[#7a3d1e]' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
