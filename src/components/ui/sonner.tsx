import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// Admin uses the light «Usta» theme only (no next-themes needed in a Vite app).
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    toastOptions={{
      classNames: {
        toast: '!rounded-2xl !bg-primary !text-primary-foreground !border-0 !font-semibold',
      },
    }}
    {...props}
  />
)

export { Toaster }
