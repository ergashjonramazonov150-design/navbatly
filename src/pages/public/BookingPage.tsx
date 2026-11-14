import { Loader2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { usePublicSalon } from '@/features/booking/api'
import { BookingWizard } from '@/features/booking/BookingWizard'

/** /b/:slug — the salon's public booking page (customers, no login). */
export function BookingPage() {
  const { t } = useTranslation('booking')
  const { slug = '' } = useParams()
  const salon = usePublicSalon(slug)

  useEffect(() => {
    if (salon.data) document.title = `${salon.data.name} — onlayn yozilish`
  }, [salon.data])

  if (salon.isPending) {
    return (
      <div
        role="status"
        className="flex min-h-dvh items-center justify-center text-muted-foreground"
      >
        <Loader2Icon className="size-6 animate-spin" aria-hidden="true" />
      </div>
    )
  }
  if (salon.isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert">{t('loadError')}</p>
        <button
          type="button"
          onClick={() => salon.refetch()}
          className="min-h-11 rounded-full px-5 font-semibold shadow-[inset_0_0_0_1.5px_var(--input)]"
        >
          {t('retry')}
        </button>
      </main>
    )
  }
  if (!salon.data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="font-heading text-2xl font-semibold">{t('notFound.title')}</h1>
        <p className="text-muted-foreground">{t('notFound.text')}</p>
      </main>
    )
  }
  return <BookingWizard salon={salon.data} />
}
