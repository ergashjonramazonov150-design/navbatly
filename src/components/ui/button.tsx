import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'

// Restyled for direction A «Usta»: pill buttons, ≥ 44 px touch targets.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/88',
        outline: 'bg-surface shadow-[inset_0_0_0_1.5px_var(--input)] hover:bg-surface-2',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-surface-2',
        success: 'bg-success text-white hover:bg-success/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        'destructive-outline':
          'text-destructive shadow-[inset_0_0_0_1.5px_#e7b8b3] hover:bg-danger-soft',
        link: 'h-auto rounded-none px-0 text-brand hover:underline',
      },
      size: {
        default: 'h-12 px-5 text-[15px]',
        sm: 'h-10 px-4 text-sm',
        lg: 'h-[52px] px-7 text-base',
        icon: 'size-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
