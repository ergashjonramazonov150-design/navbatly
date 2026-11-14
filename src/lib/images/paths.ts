/**
 * File addresses in the `salon-images` bucket (migration 9):
 *   <salon id>/<kind>/<image id>/<size>.<ext>      size = lg | sm, ext = webp | jpg | png
 * The database stores only the `lg` path; `sm` sits in the same folder.
 */
import type { ImageKind } from './specs'

export const BUCKET = 'salon-images'
export type ImageExt = 'webp' | 'jpg' | 'png'

/**
 * Random v4 UUID. NOT crypto.randomUUID(): browsers only offer that on HTTPS/localhost,
 * and the phone test runs the dev server over plain http on home Wi-Fi.
 * crypto.getRandomValues() works everywhere.
 */
export function randomUuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function newImageFolder(businessId: string, kind: ImageKind, id = randomUuid()) {
  return `${businessId}/${kind}/${id}`
}

export const filePath = (folder: string, size: 'lg' | 'sm', ext: ImageExt) =>
  `${folder}/${size}.${ext}`

/** "<folder>/lg.webp" → "<folder>/sm.webp" */
export const smallOf = (lgPath: string) => lgPath.replace(/\/lg\.(webp|jpg|png)$/, '/sm.$1')

/** both files of one stored image (what to delete) */
export const filesOf = (lgPath: string) => [lgPath, smallOf(lgPath)]

/** Public link of a file (the bucket is public; links work without a login). */
export const publicUrl = (supabaseUrl: string, path: string) =>
  `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
