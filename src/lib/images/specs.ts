/**
 * Rules for every kind of salon photo (M3.5, approved in design/05-admin-photos.html).
 * The database (migration 9) independently enforces: path layout, 5 MB, JPEG/PNG/WebP.
 */

export type ImageKind = 'cover' | 'logo' | 'staff' | 'services' | 'gallery'

/**
 * How the picture is shaped:
 *   crop    — the owner positions it in a frame (cover 3:1, barber 1:1 shown round)
 *   contain — the WHOLE image is fitted into a square on a neutral background (logo)
 *   center  — square taken from the centre, no crop window (service photo)
 *   gallery — big = whole photo (long side limited), small = centre square
 */
export type Shape = 'crop' | 'contain' | 'center' | 'gallery'

export type ImageSpec = {
  shape: Shape
  /** width / height of the result (crop + center + contain); gallery `lg` keeps the photo's own ratio */
  aspect: number
  /** largest output sizes in px (never upscaled) */
  lg: { w: number; h: number }
  sm: { w: number; h: number }
  /** smallest acceptable SOURCE photo */
  min: { w: number; h: number; rule: 'both' | 'longSide' | 'shortSide' }
}

export const SPECS: Record<ImageKind, ImageSpec> = {
  cover: {
    shape: 'crop',
    aspect: 3,
    lg: { w: 1600, h: 533 },
    sm: { w: 800, h: 267 },
    min: { w: 1200, h: 400, rule: 'both' },
  },
  staff: {
    shape: 'crop',
    aspect: 1,
    lg: { w: 480, h: 480 },
    sm: { w: 160, h: 160 },
    min: { w: 400, h: 400, rule: 'both' },
  },
  logo: {
    shape: 'contain',
    aspect: 1,
    lg: { w: 512, h: 512 },
    sm: { w: 128, h: 128 },
    min: { w: 400, h: 400, rule: 'longSide' },
  },
  services: {
    shape: 'center',
    aspect: 1,
    lg: { w: 480, h: 480 },
    sm: { w: 160, h: 160 },
    min: { w: 400, h: 400, rule: 'both' },
  },
  gallery: {
    shape: 'gallery',
    aspect: 1,
    lg: { w: 1600, h: 1600 }, // long side
    sm: { w: 400, h: 400 },
    min: { w: 400, h: 400, rule: 'shortSide' },
  },
}

/** Original file from the phone/computer — compressed in the browser before upload. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024
/** What the file picker asks for. iOS then hands over a JPEG copy of HEIC photos. */
export const ACCEPT = 'image/jpeg,image/png,image/webp'
export const GALLERY_LIMIT = 12
/** Logo background (neutral cream, same as the app surface) */
export const LOGO_BACKGROUND = '#fffdf9'
/** Breathing room around a fitted logo, as a share of the square */
export const LOGO_PADDING = 0.08
