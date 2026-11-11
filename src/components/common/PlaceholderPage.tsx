import { useTranslation } from 'react-i18next'

/** Temporary page body until the real screen is built in a later milestone. */
export function PlaceholderPage({
  title,
  description,
  milestone,
}: {
  title: string
  description: string
  milestone: string
}) {
  const { t } = useTranslation('admin')
  return (
    <>
      <h1 className="text-[25px] leading-tight font-semibold tracking-tight min-[900px]:text-3xl">
        {title}
      </h1>
      <div className="mt-5 rounded-2xl border-[1.5px] border-dashed border-input px-4 py-10 text-center text-muted-foreground">
        <p className="font-heading text-lg font-semibold text-foreground">
          {t('placeholder.comingIn', { milestone })}
        </p>
        <p className="mx-auto mt-1 max-w-md">{description}</p>
      </div>
    </>
  )
}
