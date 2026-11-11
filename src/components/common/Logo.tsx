import { cn } from 'cn'

export function Logo({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-brand font-heading text-lg font-bold text-white',
        className,
      )}
    >
      N
    </div>
  )
}
