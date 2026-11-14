import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { saveServicePhoto } from '@/features/images/api'
import { PhotoSlot } from '@/features/images/PhotoSlot'
import { servicesKey, type ServiceItem } from './api'

/**
 * Optional service photo inside the service dialog (square, centre — no crop window).
 * Saved immediately like every photo, so it needs an existing service: for a NEW service
 * we only explain that the photo can be added after saving.
 */
export function ServicePhotoField({
  businessId,
  service,
}: {
  businessId: string
  service?: ServiceItem
}) {
  const { t } = useTranslation('admin')
  const qc = useQueryClient()
  // the dialog holds a snapshot of the service → remember the CURRENT path here, so a
  // second "Almashtirish" in the same dialog deletes the right old files
  const [path, setPath] = useState(service?.photoPath ?? null)

  return (
    <div className="grid gap-1.5">
      <span className="text-[13.5px] font-semibold">
        {t('photos.service.label')}{' '}
        <span className="font-normal text-muted-foreground">{t('photos.service.optional')}</span>
      </span>
      {service ? (
        <PhotoSlot
          businessId={businessId}
          kind="services"
          path={path}
          save={async (p) => {
            await saveServicePhoto(service.id, p)
            setPath(p)
          }}
          onChanged={() => void qc.invalidateQueries({ queryKey: servicesKey(businessId) })}
          labels={{
            upload: t('photos.add'),
            replace: t('photos.replace'),
            remove: t('photos.remove'),
            saved: t('photos.saved'),
            removed: t('photos.removed'),
          }}
          preview={(urls) =>
            urls ? (
              <img
                src={urls.sm}
                alt={t('photos.service.alt', { name: service.name })}
                className="size-[72px] rounded-[14px] bg-muted object-cover"
              />
            ) : null
          }
          footer={<p className="text-[12.5px] text-muted-foreground">{t('photos.service.hint')}</p>}
        />
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{t('photos.service.afterSave')}</p>
      )}
    </div>
  )
}
