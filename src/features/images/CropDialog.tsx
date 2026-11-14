import { MinusIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * The owner positions the photo in the frame (cover 3:1, barber round). Returns the chosen
 * area in SOURCE pixels; the actual cutting happens in lib/images/process.ts.
 * Loaded lazily (React.lazy) so the crop library is only downloaded when this opens.
 */
export default function CropDialog({
  src,
  aspect,
  round,
  title,
  busy = false,
  onConfirm,
  onCancel,
}: {
  src: string
  aspect: number
  round: boolean
  title: string
  busy?: boolean
  onConfirm: (areaPixels: Area) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('admin')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [percent, setPercent] = useState<Area | null>(null)
  const setZ = (z: number) => setZoom(Math.min(3, Math.max(1, z)))

  // live preview "as on the booking page", from the area in percent of the photo
  const preview = percent && {
    backgroundImage: `url("${src}")`,
    backgroundSize: `${(100 / percent.width) * 100}% ${(100 / percent.height) * 100}%`,
    backgroundPosition: `${percent.width >= 100 ? 0 : (percent.x / (100 - percent.width)) * 100}% ${
      percent.height >= 100 ? 0 : (percent.y / (100 - percent.height)) * 100
    }%`,
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3.5">
          <DialogDescription>{t('photos.crop.hint')}</DialogDescription>
          <div className="relative h-[300px] overflow-hidden rounded-[14px] bg-[#14110e]">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={round ? 'round' : 'rect'}
              showGrid={false}
              objectFit="cover"
              onCropChange={setCrop}
              onZoomChange={setZ}
              onCropComplete={(area, areaPixels) => {
                setPercent(area)
                setPixels(areaPixels)
              }}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setZ(zoom - 0.25)}
              aria-label={t('photos.crop.zoomOut')}
            >
              <MinusIcon aria-hidden="true" />
            </Button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZ(Number(e.target.value))}
              aria-label={t('photos.crop.zoom')}
              className="h-7 flex-1 accent-foreground"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={() => setZ(zoom + 0.25)}
              aria-label={t('photos.crop.zoomIn')}
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
            <span
              aria-hidden="true"
              className={`shrink-0 bg-muted bg-no-repeat ${round ? 'size-[54px] rounded-full' : 'h-[50px] w-[150px] rounded-lg'}`}
              style={preview ?? undefined}
            />
            {t('photos.crop.preview')}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={() => pixels && onConfirm(pixels)} disabled={!pixels || busy}>
            {busy ? t('actions.saving') : t('photos.crop.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
