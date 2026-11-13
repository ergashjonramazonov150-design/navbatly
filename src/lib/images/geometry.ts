/**
 * Pure size/position maths for photo processing (no browser APIs — unit-tested).
 */
import { SPECS, type ImageKind } from './specs'

export type Rect = { x: number; y: number; w: number; h: number }
export type Size = { w: number; h: number }

export type SizeProblem =
  | { key: 'tooSmallCover'; w: number; h: number }
  | { key: 'tooSmallLogo'; w: number; h: number }
  | { key: 'tooSmall'; w: number; h: number; min: number }

/** null = big enough; otherwise which error to show (with the photo's real size). */
export function checkMinSize(kind: ImageKind, w: number, h: number): SizeProblem | null {
  const { min } = SPECS[kind]
  const ok =
    min.rule === 'both'
      ? w >= min.w && h >= min.h
      : min.rule === 'longSide'
        ? Math.max(w, h) >= min.w
        : Math.min(w, h) >= min.w
  if (ok) return null
  if (kind === 'cover') return { key: 'tooSmallCover', w, h }
  if (kind === 'logo') return { key: 'tooSmallLogo', w, h }
  return { key: 'tooSmall', w, h, min: min.w }
}

/** Largest centred rectangle with the given aspect (w/h) inside a w×h image. */
export function centerRect(w: number, h: number, aspect: number): Rect {
  if (w / h > aspect) {
    const cw = Math.round(h * aspect)
    return { x: Math.round((w - cw) / 2), y: 0, w: cw, h }
  }
  const ch = Math.round(w / aspect)
  return { x: 0, y: Math.round((h - ch) / 2), w, h: ch }
}

/** Output size for a source area: as close to `max` as possible, never bigger than the source. */
export function downscale(src: Size, max: Size): Size {
  const k = Math.min(1, max.w / src.w, max.h / src.h)
  return { w: Math.max(1, Math.round(src.w * k)), h: Math.max(1, Math.round(src.h * k)) }
}

/** Output size for a fixed shape (cover 3:1, squares): width first, height from the ratio. */
export function aspectSize(area: Size, maxW: number, aspect: number): Size {
  const w = Math.max(1, Math.round(Math.min(maxW, area.w)))
  return { w, h: Math.max(1, Math.round(w / aspect)) }
}

/** Where to draw a w×h image inside a `box`-sized square so it fits WHOLE (logo), with padding. */
export function containRect(w: number, h: number, box: number, padding: number): Rect {
  const inner = box * (1 - 2 * padding)
  const k = Math.min(inner / w, inner / h)
  const dw = Math.round(w * k)
  const dh = Math.round(h * k)
  return { x: Math.round((box - dw) / 2), y: Math.round((box - dh) / 2), w: dw, h: dh }
}

/** Keeps a crop area (e.g. from the crop tool) inside the image and whole pixels. */
export function clampRect(r: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(Math.round(r.x), w - 1))
  const y = Math.max(0, Math.min(Math.round(r.y), h - 1))
  return {
    x,
    y,
    w: Math.max(1, Math.min(Math.round(r.w), w - x)),
    h: Math.max(1, Math.min(Math.round(r.h), h - y)),
  }
}

/** «Ishlarimiz»: how many of the picked files fit under the limit. */
export function planBatch<T>(picked: T[], existing: number, limit: number) {
  const room = Math.max(0, limit - existing)
  return { take: picked.slice(0, room), skipped: Math.max(0, picked.length - room) }
}
