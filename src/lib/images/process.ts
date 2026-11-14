/**
 * Turns a picked photo into the small files we upload — entirely in the browser:
 *   decode (phone rotation applied) → check size → shape (crop / fit / centre) →
 *   resize (never upscale) → encode WebP (JPEG if the browser can't make WebP).
 * Re-encoding also drops the photo's hidden metadata (e.g. GPS location).
 * Pure maths lives in geometry.ts (unit-tested); this file is checked in real Chrome
 * by scripts/image-check.mjs.
 */
import {
  aspectSize,
  centerRect,
  checkMinSize,
  clampRect,
  containRect,
  downscale,
  type Rect,
  type SizeProblem,
} from './geometry'
import type { ImageExt } from './paths'
import { LOGO_BACKGROUND, LOGO_PADDING, MAX_INPUT_BYTES, SPECS, type ImageKind } from './specs'

export type ImageErrorKey = 'tooLarge' | 'unreadable' | SizeProblem['key']

export class ImageError extends Error {
  readonly key: ImageErrorKey
  readonly params: Record<string, number>
  constructor(key: ImageErrorKey, params: Record<string, number> = {}) {
    super(key)
    this.key = key
    this.params = params
  }
}

export type ProcessedImage = { lg: Blob; sm: Blob; ext: ImageExt; width: number; height: number }

type Source = { draw: CanvasImageSource; w: number; h: number; close: () => void }

/** Opens the file as a picture, with the phone's rotation applied. */
export async function decodeImage(file: Blob): Promise<Source> {
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('tooLarge')
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { draw: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
  } catch {
    // older Safari: fall back to an <img> (browsers apply the photo rotation there too)
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return { draw: img, w: img.naturalWidth, h: img.naturalHeight, close: () => {} }
    } catch {
      throw new ImageError('unreadable') // e.g. HEIC on a computer, or a broken file
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Quick check right after picking: readable + big enough. Returns the photo size. */
export async function inspectImage(file: Blob, kind: ImageKind) {
  const src = await decodeImage(file)
  const size = { w: src.w, h: src.h }
  src.close()
  const problem = checkMinSize(kind, size.w, size.h)
  if (problem) throw new ImageError(problem.key, sizeParams(problem))
  return size
}

const sizeParams = (p: SizeProblem): Record<string, number> =>
  p.key === 'tooSmall' ? { w: p.w, h: p.h, min: p.min } : { w: p.w, h: p.h }

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new ImageError('unreadable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { c, ctx }
}

const toBlob = (c: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality))

/** WebP when the browser can make it (Safari can't), else JPEG — both allowed by the bucket. */
async function encode(
  c: HTMLCanvasElement,
  prefer?: ImageExt,
): Promise<{ blob: Blob; ext: ImageExt }> {
  if (prefer !== 'jpg') {
    const webp = await toBlob(c, 'image/webp', 0.82)
    if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' }
  }
  const jpg = await toBlob(c, 'image/jpeg', 0.85)
  if (!jpg) throw new ImageError('unreadable')
  return { blob: jpg, ext: 'jpg' }
}

/** Draws `area` of the source into a new canvas of size `out`. */
function drawArea(src: Source, area: Rect, out: { w: number; h: number }) {
  const { c, ctx } = canvas(out.w, out.h)
  ctx.drawImage(src.draw, area.x, area.y, area.w, area.h, 0, 0, out.w, out.h)
  return c
}

/** Logo: the WHOLE image fitted into a square on a neutral background. */
function drawContained(src: Source, box: number) {
  const { c, ctx } = canvas(box, box)
  ctx.fillStyle = LOGO_BACKGROUND
  ctx.fillRect(0, 0, box, box)
  const r = containRect(src.w, src.h, box, LOGO_PADDING)
  ctx.drawImage(src.draw, 0, 0, src.w, src.h, r.x, r.y, r.w, r.h)
  return c
}

/**
 * @param crop for 'crop' kinds (cover, barber): the area chosen in the crop tool, in source
 *             pixels. Missing → the centre.
 */
export async function processImage(
  file: Blob,
  kind: ImageKind,
  crop?: Rect,
): Promise<ProcessedImage> {
  const spec = SPECS[kind]
  const src = await decodeImage(file)
  try {
    const problem = checkMinSize(kind, src.w, src.h)
    if (problem) throw new ImageError(problem.key, sizeParams(problem))

    let lgCanvas: HTMLCanvasElement
    let smCanvas: HTMLCanvasElement
    if (spec.shape === 'contain') {
      // a logo smaller than 512 px is fitted into a square of its own long side
      const box = Math.min(spec.lg.w, Math.max(src.w, src.h))
      lgCanvas = drawContained(src, box)
      smCanvas = drawContained(src, spec.sm.w)
    } else if (spec.shape === 'gallery') {
      const whole = { x: 0, y: 0, w: src.w, h: src.h }
      lgCanvas = drawArea(src, whole, downscale(whole, spec.lg))
      const sq = centerRect(src.w, src.h, 1)
      smCanvas = drawArea(src, sq, downscale(sq, spec.sm))
    } else {
      const area =
        spec.shape === 'crop' && crop
          ? clampRect(crop, src.w, src.h)
          : centerRect(src.w, src.h, spec.aspect)
      lgCanvas = drawArea(src, area, aspectSize(area, spec.lg.w, spec.aspect))
      smCanvas = drawArea(src, area, aspectSize(area, spec.sm.w, spec.aspect))
    }

    const lg = await encode(lgCanvas)
    const sm = await encode(smCanvas, lg.ext) // same format for both sizes
    return { lg: lg.blob, sm: sm.blob, ext: lg.ext, width: lgCanvas.width, height: lgCanvas.height }
  } finally {
    src.close()
  }
}
