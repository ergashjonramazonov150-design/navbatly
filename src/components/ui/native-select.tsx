import * as React from 'react'
import { cn } from 'cn'
import { ChevronDownIcon } from 'lucide-react'

/**
 * Styled native <select>. On phones it opens the system picker (best UX on mobile);
 * styled like Input (direction A).
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'h-12 w-full cursor-pointer appearance-none rounded-xl border-[1.5px] border-input bg-surface pr-10 pl-3.5 text-base outline-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
