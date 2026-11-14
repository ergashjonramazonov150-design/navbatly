import { ChevronLeftIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/** /privacy — short, plain-language privacy notice (M8). Linked from the landing + booking. */
export function PrivacyPage() {
  const { t } = useTranslation()
  useEffect(() => {
    document.title = `${t('privacy.title')} — Navbatly`
  }, [t])
  const parts = [1, 2, 3, 4, 5, 6] as const
  return (
    <main className="mx-auto max-w-[680px] px-5 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex min-h-11 items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-5" aria-hidden="true" />
        {t('privacy.back')}
      </Link>
      <h1 className="font-heading text-[34px] leading-tight font-semibold">{t('privacy.title')}</h1>
      <p className="mt-1 text-[14px] text-muted-foreground">{t('privacy.updated')}</p>
      <p className="mt-6 text-[17px]">{t('privacy.intro')}</p>
      {parts.map((n) => (
        <section key={n} className="mt-7">
          <h2 className="font-heading text-[21px] font-semibold">{t(`privacy.h${n}`)}</h2>
          <p className="mt-2 text-foreground/85">{t(`privacy.p${n}`)}</p>
        </section>
      ))}
    </main>
  )
}
