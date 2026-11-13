import { Loader2Icon } from 'lucide-react'
import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { inspectImage, processImage } from '@/lib/images/process'
import type { Rect } from '@/lib/images/geometry'
import { ACCEPT, SPECS, type ImageKind } from '@/lib/images/specs'
import { imageErrorKey, imageErrorParams, imageUrls, removeImage, replaceImage } from './api'

const CropDialog = lazy(() => import('./CropDialog'))

export type SlotState = 'preparing' | 'uploading' | 'removing' | null

/**
 * One photo slot (cover, logo, barber, service). Saves IMMEDIATELY (approved 2b):
 * pick → [crop window for cover/barber] → prepare in the browser → upload → save path →
 * delete the old files. "Olib tashlash" asks first (a deleted photo cannot come back).
 */
export function PhotoSlot({
  businessId,
  kind,
  path,
  save,
  onChanged,
  preview,
  labels,
  disabled = false,
  footer,
}: {
  businessId: string
  kind: Exclude<ImageKind, 'gallery'>
  path: string | null
  /** writes the new path (or null) to the database */
  save: (path: string | null) => Promise<void>
  onChanged: () => void
  preview: (urls: ReturnType<typeof imageUrls>, state: SlotState) => ReactNode
  labels: {
    upload: string
    replace: string
    remove: string
    saved: string
    removed: string
    cropTitle?: string
  }
  disabled?: boolean
  footer?: ReactNode
}) {
  const { t } = useTranslation(['admin', 'errors'])
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<SlotState>(null)
  const [error, setError] = useState<string | null>(null)
  const [crop, setCrop] = useState<{ file: File; url: string } | null>(null)
  const [askRemove, setAskRemove] = useState(false)
  const spec = SPECS[kind]
  const busy = state !== null

  const showError = (err: unknown) =>
    setError(t(`errors:${imageErrorKey(err)}` as 'errors:db.unknown', imageErrorParams(err)))

  const closeCrop = () => {
    if (crop) URL.revokeObjectURL(crop.url)
    setCrop(null)
  }

  async function upload(file: File, area?: Rect) {
    setState('preparing')
    try {
      const image = await processImage(file, kind, area)
      setState('uploading')
      await replaceImage({ businessId, kind, image, oldPath: path, save })
      toast.success(labels.saved)
      onChanged()
    } catch (err) {
      showError(err)
    } finally {
      setState(null)
      closeCrop()
    }
  }

  async function picked(file: File | undefined) {
    if (!file) return
    setError(null)
    if (spec.shape !== 'crop') return upload(file)
    // check readability + size BEFORE opening the crop window
    setState('preparing')
    try {
      await inspectImage(file, kind)
      setCrop({ file, url: URL.createObjectURL(file) })
    } catch (err) {
      showError(err)
    } finally {
      setState(null)
    }
  }

  async function remove() {
    if (!path) return
    setState('removing')
    try {
      await removeImage(path, () => save(null))
      toast.success(labels.removed)
      onChanged()
    } catch (err) {
      showError(err)
    } finally {
      setState(null)
      setAskRemove(false)
    }
  }

  return (
    <div className="grid gap-2.5">
      <div className="relative w-fit max-w-full">
        {preview(imageUrls(path), state)}
        {(state === 'preparing' || state === 'uploading') && !crop && (
          <span
            role="status"
            className="absolute inset-0 grid place-content-center justify-items-center gap-1.5 rounded-[inherit] bg-surface/85 p-2 text-center text-[12.5px] font-semibold text-foreground"
          >
            <Loader2Icon className="size-5 animate-spin text-brand" aria-hidden="true" />
            {state === 'preparing' ? t('photos.preparing') : t('photos.uploading')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || disabled}
          onClick={() => input.current?.click()}
        >
          {path ? labels.replace : labels.upload}
        </Button>
        {path && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive shadow-[inset_0_0_0_1.5px_#e7b8b3]"
            disabled={busy || disabled}
            onClick={() => setAskRemove(true)}
          >
            {labels.remove}
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            void picked(e.target.files?.[0])
            e.target.value = '' // picking the same file again still triggers
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      {footer}

      {crop && (
        <Suspense fallback={null}>
          <CropDialog
            src={crop.url}
            aspect={spec.aspect}
            round={kind === 'staff'}
            title={labels.cropTitle ?? ''}
            busy={busy}
            onCancel={closeCrop}
            onConfirm={(a) => void upload(crop.file, { x: a.x, y: a.y, w: a.width, h: a.height })}
          />
        </Suspense>
      )}
      {askRemove && (
        <ConfirmDialog
          title={t('photos.confirmTitle')}
          text={t('photos.confirmText')}
          confirmLabel={t('photos.confirmDelete')}
          busy={state === 'removing'}
          onConfirm={() => void remove()}
          onClose={() => setAskRemove(false)}
        />
      )}
    </div>
  )
}
