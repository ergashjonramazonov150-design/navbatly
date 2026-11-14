import { vi } from 'vitest'

import { supabase } from '@/lib/supabase'

/**
 * Recording fakes for Supabase (tables + Storage), used by the photo tests.
 * Every call lands in `log` IN ORDER, so tests can check the documented sequence:
 * upload → save path → delete old files (docs/ARCHITECTURE.md).
 */
export type LogEntry =
  | { kind: 'upload'; path: string; type: string }
  | { kind: 'remove'; paths: string[] }
  | { kind: 'db'; table: string; op: string; payload?: unknown; filters: unknown[][] }

export function installFakeSupabase(opts: {
  /** rows returned by selects, per table */
  rows?: Record<string, unknown>
  /** make a table write fail (e.g. { code: 'P0001', message: 'GALLERY_FULL' }) */
  dbError?: (table: string, op: string) => { code: string; message: string } | null
  uploadError?: (path: string) => { message: string } | null
}) {
  const log: LogEntry[] = []

  vi.mocked(supabase.from).mockImplementation(((table: string) => {
    const entry: LogEntry = { kind: 'db', table, op: 'select', filters: [] }
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'order', 'in', 'gte', 'gt', 'is', 'not', 'select']) {
      b[m] = vi.fn((...args: unknown[]) => {
        if (m !== 'select') entry.filters.push([m, ...args])
        return b
      })
    }
    for (const op of ['update', 'insert', 'delete'] as const) {
      b[op] = vi.fn((payload?: unknown) => {
        entry.op = op
        entry.payload = payload
        log.push(entry)
        return b
      })
    }
    const result = () => {
      const err = entry.op === 'select' ? null : (opts.dbError?.(table, entry.op) ?? null)
      if (err) return { data: null, error: err }
      return {
        data: entry.op === 'select' ? (opts.rows?.[table] ?? null) : { id: 'row-1' },
        error: null,
      }
    }
    b.single = vi.fn(async () => result())
    b.maybeSingle = vi.fn(async () => result())
    b.then = (resolve: (v: unknown) => void) => resolve(result())
    return b
  }) as never)

  vi.mocked(supabase.storage.from).mockImplementation((() => ({
    upload: vi.fn(async (path: string, blob: Blob) => {
      log.push({ kind: 'upload', path, type: blob.type })
      const err = opts.uploadError?.(path) ?? null
      return err ? { data: null, error: err } : { data: { path }, error: null }
    }),
    remove: vi.fn(async (paths: string[]) => {
      log.push({ kind: 'remove', paths })
      return { data: paths.map((name) => ({ name })), error: null }
    }),
  })) as never)

  return log
}

/** What processImage would return — small fake files (the real one is checked in Chrome). */
export const fakeProcessed = (ext: 'webp' | 'jpg' = 'webp') => ({
  lg: new Blob(['lg'], { type: ext === 'webp' ? 'image/webp' : 'image/jpeg' }),
  sm: new Blob(['sm'], { type: ext === 'webp' ? 'image/webp' : 'image/jpeg' }),
  ext,
  width: 480,
  height: 480,
})
