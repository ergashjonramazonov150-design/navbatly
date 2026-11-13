/**
 * File addresses in the `salon-images` bucket (migration 9):
 *   <salon id>/<kind>/<image id>/<size>.<ext>      size = lg | sm, ext = webp | jpg | png
 * The database stores only the `lg` path; `sm` sits in the same folder.
 */
import type { ImageKind } from './specs'

export const BUCKET = 'salon-images'
export type ImageExt = 'webp' | 'jpg' | 'png'

export function newImageFolder(businessId: string, kind: ImageKind, id = crypto.randomUUID()) {
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
