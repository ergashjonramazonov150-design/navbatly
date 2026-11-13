/**
 * Salon photos: upload / replace / remove, in the order documented in
 * docs/ARCHITECTURE.md ("Salon images: upload order and orphan clean-up"):
 *   1 prepare in the browser → 2 upload new files → 3 save the path in the database →
 *   4 delete the old files.
 * The database therefore never points to a missing file. A failed delete leaves an
 * orphan file, found later by public.list_orphan_salon_images (npm run storage:orphans).
 */
import { useQuery } from '@tanstack/react-query'

import { dbErrorKey } from '@/lib/dbErrors'
import { SUPABASE_URL } from '@/lib/env'
import { ImageError, type ProcessedImage } from '@/lib/images/process'
import { BUCKET, filePath, filesOf, newImageFolder, publicUrl, smallOf } from '@/lib/images/paths'
import type { ImageKind } from '@/lib/images/specs'
import { supabase } from '@/lib/supabase'

/** Public links of the two sizes of a stored image (null = no photo). */
export function imageUrls(lgPath: string | null | undefined) {
  if (!lgPath) return null
  return { lg: publicUrl(SUPABASE_URL, lgPath), sm: publicUrl(SUPABASE_URL, smallOf(lgPath)) }
}

/** Step 2: upload `lg` + `sm` into a NEW folder. Returns the `lg` path. */
export async function uploadImage(businessId: string, kind: ImageKind, img: ProcessedImage) {
  const folder = newImageFolder(businessId, kind)
  const lg = filePath(folder, 'lg', img.ext)
  const sm = filePath(folder, 'sm', img.ext)
  // every path is new and never reused → the CDN may cache it "forever"
  const opts = (blob: Blob) => ({ contentType: blob.type, cacheControl: '31536000', upsert: false })
  const up1 = await supabase.storage.from(BUCKET).upload(lg, img.lg, opts(img.lg))
  if (up1.error) throw up1.error
  const up2 = await supabase.storage.from(BUCKET).upload(sm, img.sm, opts(img.sm))
  if (up2.error) {
    await removeImageFiles(lg) // best effort: don't leave half an image behind
    throw up2.error
  }
  return lg
}

/** Deletes both sizes of a stored image. Never throws: false = left as an orphan. */
export async function removeImageFiles(lgPath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(filesOf(lgPath))
    return !error
  } catch {
    return false
  }
}

/**
 * Steps 2–4 for any photo slot. `save` writes the new path (or null) to the database.
 * On a save failure the just-uploaded files are removed and the old photo stays.
 */
export async function replaceImage(args: {
  businessId: string
  kind: ImageKind
  image: ProcessedImage
  oldPath: string | null | undefined
  save: (newPath: string) => Promise<void>
}) {
  const newPath = await uploadImage(args.businessId, args.kind, args.image)
  try {
    await args.save(newPath)
  } catch (err) {
    await removeImageFiles(newPath)
    throw err
  }
  if (args.oldPath) await removeImageFiles(args.oldPath) // failure → orphan, cleaned up later
  return newPath
}

/** Remove a photo: database first (stop pointing to it), then the files. */
export async function removeImage(oldPath: string, clear: () => Promise<void>) {
  await clear()
  await removeImageFiles(oldPath)
}

const ok = ({ error }: { error: unknown }) => {
  if (error) throw error
}

/* ----------------------------- database writes ----------------------------- */
export const saveBusinessImage = async (
  businessId: string,
  slot: 'cover' | 'logo',
  path: string | null,
) =>
  ok(
    await supabase
      .from('businesses')
      .update(slot === 'cover' ? { cover_path: path } : { logo_path: path })
      .eq('id', businessId)
      .select('id')
      .single(),
  )

export const saveStaffPhoto = async (staffId: string, path: string | null) =>
  ok(
    await supabase
      .from('staff')
      .update({ photo_path: path })
      .eq('id', staffId)
      .select('id')
      .single(),
  )

export const saveServicePhoto = async (serviceId: string, path: string | null) =>
  ok(
    await supabase
      .from('services')
      .update({ photo_path: path })
      .eq('id', serviceId)
      .select('id')
      .single(),
  )

export const addGalleryRow = async (businessId: string, path: string) =>
  ok(
    await supabase
      .from('salon_photos')
      .insert({ business_id: businessId, path })
      .select('id')
      .single(),
  )

export const deleteGalleryRow = async (id: string) =>
  ok(await supabase.from('salon_photos').delete().eq('id', id).select('id').single())

/* ----------------------------- reading ----------------------------- */
export type GalleryPhoto = { id: string; path: string }
export type SalonImages = {
  coverPath: string | null
  logoPath: string | null
  gallery: GalleryPhoto[]
}

export const salonImagesKey = (businessId: string) => ['salon-images', businessId] as const

export function useSalonImages(businessId: string) {
  return useQuery({
    queryKey: salonImagesKey(businessId),
    queryFn: async (): Promise<SalonImages> => {
      const [biz, gallery] = await Promise.all([
        supabase.from('businesses').select('cover_path, logo_path').eq('id', businessId).single(),
        supabase
          .from('salon_photos')
          .select('id, path')
          .eq('business_id', businessId)
          .order('created_at', { ascending: true }),
      ])
      if (biz.error) throw biz.error
      if (gallery.error) throw gallery.error
      return { coverPath: biz.data.cover_path, logoPath: biz.data.logo_path, gallery: gallery.data }
    },
  })
}

/* ----------------------------- errors ----------------------------- */
/** Translation key in errors.json for any failure while preparing / uploading / saving. */
export function imageErrorKey(err: unknown): string {
  if (err instanceof ImageError) return `images.${err.key}`
  const db = dbErrorKey(err)
  if (db.startsWith('rpc.') || db === 'db.forbidden') return db
  return 'images.uploadFailed' // network / storage refused: nothing changed, old photo stays
}

export const imageErrorParams = (err: unknown) => (err instanceof ImageError ? err.params : {})
