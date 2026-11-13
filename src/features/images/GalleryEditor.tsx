import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { planBatch } from '@/lib/images/geometry'
import { processImage } from '@/lib/images/process'
import { ACCEPT, GALLERY_LIMIT } from '@/lib/images/specs'
import {
  addGalleryRow,
  deleteGalleryRow,
  imageErrorKey,
  imageErrorParams,
  imageUrls,
  removeImage,
  replaceImage,
  type GalleryPhoto,
} from './api'

/**
 * «Ishlarimiz»: up to 12 photos, upload order, delete only. Several files can be picked at
 * once; only what fits is uploaded, one after another (keeps phone memory low), then one
 * clear summary: "5 ta qo'shildi, 3 tasi sig'madi (limit 12)".
 */
export function GalleryEditor({
  businessId,
  photos,
  onChanged,
}: {
  businessId: string
  photos: GalleryPhoto[]
  onChanged: () => void
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{
    total: number
    done: number
    stage: 'preparing' | 'uploading'
  } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<{ photo: GalleryPhoto; n: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const count = photos.length
  const full = count >= GALLERY_LIMIT

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    const { take, skipped } = planBatch([...list], count, GALLERY_LIMIT)
    let added = 0
    const failures: unknown[] = []
    for (const [i, file] of take.entries()) {
      try {
        setPending({ total: take.length, done: i, stage: 'preparing' })
        const image = await processImage(file, 'gallery')
        setPending({ total: take.length, done: i, stage: 'uploading' })
        await replaceImage({
          businessId,
          kind: 'gallery',
          image,
          oldPath: null,
          save: (path) => addGalleryRow(businessId, path),
        })
        added++
      } catch (err) {
        failures.push(err)
      }
    }
    setPending(null)
    onChanged()

    const parts = [
      skipped > 0
        ? t('photos.batchSkipped', { added, skipped })
        : added > 0
          ? t('photos.batchAdded', { count: added })
          : '',
    ]
    if (failures.length) {
      const first = failures[0]
      parts.push(
        t('photos.batchFailed', {
          failed: failures.length,
          reason: t(
            `errors:${imageErrorKey(first)}` as 'errors:db.unknown',
            imageErrorParams(first),
          ),
        }),
      )
    }
    setNote(parts.filter(Boolean).join(' '))
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await removeImage(toDelete.photo.path, () => deleteGalleryRow(toDelete.photo.id))
      toast.success(t('photos.deleted'))
      setNote(null)
      onChanged()
    } catch (err) {
      toast.error(t(`errors:${imageErrorKey(err)}` as 'errors:db.unknown'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-[13.5px]">{t('photos.gallery')}</b>
        <span className={`text-[13px] font-bold ${full ? 'text-brand' : 'text-muted-foreground'}`}>
          {t('photos.galleryCount', { count })}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2 min-[600px]:grid-cols-6 min-[600px]:gap-2.5">
        {photos.map((p, i) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            <img
              src={imageUrls(p.path)?.sm}
              alt={t('photos.photoAlt', { n: i + 1 })}
              loading="lazy"
              className="size-full object-cover"
            />
            <button
              type="button"
              disabled={!!pending}
              onClick={() => setToDelete({ photo: p, n: i + 1 })}
              aria-label={t('photos.deleteLabel', { n: i + 1 })}
              className="absolute top-1.5 right-1.5 grid size-[34px] place-items-center rounded-full bg-foreground/70 text-white before:absolute before:-inset-[5px] before:content-[''] disabled:opacity-50"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
        {pending &&
          Array.from({ length: pending.total - pending.done }, (_, k) => (
            <li
              key={`pending-${k}`}
              role={k === 0 ? 'status' : undefined}
              className="grid aspect-square place-content-center justify-items-center gap-1.5 rounded-xl bg-surface-2 p-2 text-center text-[12px] font-semibold"
            >
              <Loader2Icon className="size-5 animate-spin text-brand" aria-hidden="true" />
              {k === 0 &&
                (pending.stage === 'preparing' ? t('photos.preparing') : t('photos.uploading'))}
            </li>
          ))}
        <li>
          <button
            type="button"
            disabled={full || !!pending}
            onClick={() => input.current?.click()}
            className="grid aspect-square w-full place-content-center justify-items-center gap-0.5 rounded-xl border-2 border-dashed border-input bg-surface-2 p-1.5 text-[12.5px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="size-6" aria-hidden="true" />
            {full ? t('photos.noRoom') : t('photos.add')}
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </li>
      </ul>

      {note && (
        <p
          role="status"
          className="rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-3 text-[13px] text-[#6d2f14]"
        >
          {note}
        </p>
      )}
      {full ? (
        <p className="rounded-xl border border-[#ecc9b4] bg-brand-soft px-3.5 py-3 text-[13px] text-[#6d2f14]">
          {t('photos.galleryFull')}
        </p>
      ) : (
        <p className="text-[12.5px] text-muted-foreground">{t('photos.galleryHint')}</p>
      )}

      {toDelete && (
        <ConfirmDialog
          title={t('photos.confirmTitle')}
          text={t('photos.confirmText')}
          confirmLabel={t('photos.confirmDelete')}
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onClose={() => setToDelete(null)}
        >
          <img
            src={imageUrls(toDelete.photo.path)?.sm}
            alt={t('photos.photoAlt', { n: toDelete.n })}
            className="mt-3 aspect-square w-[120px] rounded-xl object-cover"
          />
        </ConfirmDialog>
      )}
    </div>
  )
}
