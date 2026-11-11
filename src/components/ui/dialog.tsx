import * as React from 'react'
import { cn } from 'cn'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'

/*
 * Restyled for direction A «Usta» (design/03-admin.html):
 *   phones (< 600px): bottom sheet, full width, rounded top
 *   larger screens:  centred card, max 560px
 * Body scrolls; header and footer stay visible. Radix handles focus trap, Esc and aria.
 */

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-[rgba(31,27,22,0.45)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  closeLabel = 'Yopish',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface text-foreground shadow-[0_30px_70px_rgba(31,27,22,0.3)] outline-none',
          // phone: bottom sheet
          'inset-x-0 bottom-0 rounded-t-[22px] data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom',
          // ≥ 600px: centred card
          'min-[600px]:inset-x-auto min-[600px]:bottom-auto min-[600px]:top-1/2 min-[600px]:left-1/2 min-[600px]:max-h-[calc(100dvh-32px)] min-[600px]:max-w-[560px] min-[600px]:-translate-x-1/2 min-[600px]:-translate-y-1/2 min-[600px]:rounded-[22px] min-[600px]:data-open:zoom-in-95 min-[600px]:data-open:slide-in-from-bottom-0',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          aria-label={closeLabel}
        >
          <XIcon className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1 px-5 pt-5 pr-16 pb-2', className)}
      {...props}
    />
  )
}

/** Scrollable middle part. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('grid gap-4 overflow-y-auto px-5 py-3', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-wrap justify-end gap-2.5 border-t border-border px-5 pt-3.5 pb-[calc(16px+env(safe-area-inset-bottom))] min-[600px]:pb-5 max-[599px]:[&>*]:flex-1',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-[22px] leading-tight font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
