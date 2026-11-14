import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { formatTime } from '@/lib/datetime'

// Temporary home page (real landing page = M8, mockup design/04): links to the demo + admin.
export function LandingPage() {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('hello.title')}</h1>
      <p className="text-muted-foreground">{t('hello.subtitle')}</p>
      <p className="text-sm text-muted-foreground tabular-nums">
        {t('hello.tashkentTime', { time: formatTime(now) })}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/b/demo">{t('hello.demo')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/login">{t('hello.admin')}</Link>
        </Button>
      </div>
    </main>
  )
}
