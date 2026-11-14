import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { InitialsAvatar } from '@/components/common/InitialsAvatar'
import { saveStaffPhoto } from '@/features/images/api'
import { PhotoSlot } from '@/features/images/PhotoSlot'
import { staffListKey, type StaffItem } from './api'

/** Usta → Profil → «Rasm»: round photo chosen by the owner, with the consent note. */
export function StaffPhotoCard({ staff, businessId }: { staff: StaffItem; businessId: string }) {
  const { t } = useTranslation('admin')
  const qc = useQueryClient()

  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{t('photos.staff.title')}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{t('photos.staff.hint')}</p>
      <div className="grid gap-4">
        <PhotoSlot
          businessId={businessId}
          kind="staff"
          path={staff.photoPath}
          save={(p) => saveStaffPhoto(staff.id, p)}
          onChanged={() => void qc.invalidateQueries({ queryKey: staffListKey(businessId) })}
          labels={{
            upload: t('photos.upload'),
            replace: t('photos.replace'),
            remove: t('photos.staff.remove'),
            saved: t('photos.saved'),
            removed: t('photos.staff.removed'),
            cropTitle: t('photos.crop.staffTitle'),
          }}
          preview={(urls) =>
            urls ? (
              <img
                src={urls.lg}
                alt={t('photos.staff.alt', { name: staff.fullName })}
                className="size-24 rounded-full bg-muted object-cover"
              />
            ) : (
              <InitialsAvatar name={staff.fullName} className="size-24 text-[34px]" />
            )
          }
        />
        <p className="flex gap-2.5 rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-3 text-[13px] text-[#6d2f14]">
          <span aria-hidden="true">🤝</span>
          <span>
            <b>{t('photos.staff.consent')}</b> {t('photos.staff.consentMore')}
          </span>
        </p>
      </div>
    </section>
  )
}
