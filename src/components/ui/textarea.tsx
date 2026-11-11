import * as React from 'react'
import { cn } from 'cn'

// Restyled to match Input (direction A). text-base prevents iOS zoom-on-focus.
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-20 w-full rounded-xl border-[1.5px] border-input bg-surface px-3.5 py-2.5 text-base transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
