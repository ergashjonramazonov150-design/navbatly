import { useQueryClient } from '@tanstack/react-query'
import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LoadError } from '@/components/common/PageHeader'
import { saveBusinessImage, salonImagesKey, useSalonImages } from '@/features/images/api'
import { GalleryEditor } from '@/features/images/GalleryEditor'
import { PhotoSlot } from '@/features/images/PhotoSlot'

/** Sozlamalar → «Salon rasmlari»: cover (3:1, owner crops), logo (fitted whole), «Ishlarimiz». */
export function SalonPhotosCard({
  businessId,
  salonName,
}: {
  businessId: string
  salonName: string
}) {
  const { t } = useTranslation('admin')
  const qc = useQueryClient()
  const images = useSalonImages(businessId)
  const refresh = () => void qc.invalidateQueries({ queryKey: salonImagesKey(businessId) })

  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{t('photos.cardTitle')}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{t('photos.cardHint')}</p>

      {images.isPending ? (
        <div role="status" className="flex items-center gap-3 py-4 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
          {t('account.loading')}
        </div>
      ) : images.isError ? (
        <LoadError
          text={t('account.loadError')}
          retryLabel={t('actions.retry')}
          onRetry={() => images.refetch()}
        />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <b className="text-[13.5px]">{t('photos.cover')}</b>
            <PhotoSlot
              businessId={businessId}
              kind="cover"
              path={images.data.coverPath}
              save={(p) => saveBusinessImage(businessId, 'cover', p)}
              onChanged={refresh}
              labels={{
                upload: t('photos.upload'),
                replace: t('photos.replace'),
                remove: t('photos.remove'),
                saved: t('photos.saved'),
                removed: t('photos.coverRemoved'),
                cropTitle: t('photos.crop.coverTitle'),
              }}
              preview={(urls) =>
                urls ? (
                  <img
                    src={urls.lg}
                    srcSet={`${urls.sm} 800w, ${urls.lg} 1600w`}
                    sizes="(max-width: 600px) 100vw, 720px"
                    alt={t('photos.coverAlt')}
                    className="aspect-[3/1] w-[720px] max-w-full rounded-[14px] bg-muted object-cover"
                  />
                ) : (
                  <div className="grid aspect-[3/1] w-[720px] max-w-full place-items-center rounded-[14px] border-2 border-dashed border-input bg-surface-2 p-3 text-center text-[13.5px] text-muted-foreground">
                    {t('photos.coverEmpty')}
                  </div>
                )
              }
              footer={
                <p className="text-[12.5px] text-muted-foreground">{t('photos.coverHint')}</p>
              }
            />
          </div>

          <div className="grid gap-2">
            <b className="text-[13.5px]">{t('photos.logo')}</b>
            <PhotoSlot
              businessId={businessId}
              kind="logo"
              path={images.data.logoPath}
              save={(p) => saveBusinessImage(businessId, 'logo', p)}
              onChanged={refresh}
              labels={{
                upload: t('photos.uploadLogo'),
                replace: t('photos.replace'),
                remove: t('photos.remove'),
                saved: t('photos.logoSaved'),
                removed: t('photos.logoRemoved'),
              }}
              preview={(urls) =>
                urls ? (
                  <span className="flex items-center gap-3">
                    <img
                      src={urls.lg}
                      alt={t('photos.logoAlt')}
                      className="size-[88px] rounded-[22px] border-[1.5px] border-border object-contain"
                    />
                    <img
                      src={urls.sm}
                      alt=""
                      className="size-11 rounded-xl border-[1.5px] border-border object-contain"
                    />
                  </span>
                ) : (
                  <span
                    role="img"
                    aria-label={t('photos.logoNone')}
                    className="grid size-[88px] place-items-center rounded-[22px] bg-brand font-heading text-[38px] font-bold text-white"
                  >
                    {salonName.trim()[0]?.toUpperCase() ?? 'N'}
                  </span>
                )
              }
              footer={<p className="text-[12.5px] text-muted-foreground">{t('photos.logoHint')}</p>}
            />
          </div>

          <GalleryEditor businessId={businessId} photos={images.data.gallery} onChanged={refresh} />
        </div>
      )}
    </section>
  )
}
