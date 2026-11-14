/**
 * Turns a database (PostgREST) error into a translation key in errors.json ("db.*").
 * The database is the source of truth for rules (CHECK constraints, RLS, EXCLUDE);
 * this only chooses a friendly Uzbek message — never shows raw SQL to users.
 */
export type DbErrorKey =
  | 'db.invalidValue'
  | 'db.overlap'
  | 'db.duplicate'
  | 'db.forbidden'
  | 'db.notFound'
  | 'db.network'
  | 'db.unknown'
  | `rpc.${RpcCode}`

/** Business-error codes raised by our database functions (message = code, errcode P0001). */
const RPC_CODES = ['NOT_ALLOWED', 'INVALID_HOURS', 'HOURS_OVERLAP', 'GALLERY_FULL'] as const
type RpcCode = (typeof RPC_CODES)[number]

const BY_CODE: Record<string, DbErrorKey> = {
  '23514': 'db.invalidValue', // check_violation (e.g. price < 0, name too short)
  '22001': 'db.invalidValue', // value too long
  '23502': 'db.invalidValue', // not_null_violation
  '23P01': 'db.overlap', // exclusion_violation (overlapping bookings / hours)
  '23505': 'db.duplicate', // unique_violation
  '42501': 'db.forbidden', // RLS / missing privilege
  PGRST116: 'db.notFound', // .single() matched 0 rows (often: RLS hid the row)
}

export function dbErrorKey(error: unknown): DbErrorKey {
  if (!error || typeof error !== 'object') return 'db.unknown'
  const e = error as { code?: unknown; message?: unknown }
  if (e.code === 'P0001' && RPC_CODES.includes(e.message as RpcCode)) {
    return `rpc.${e.message as RpcCode}`
  }
  if (typeof e.code === 'string' && e.code in BY_CODE) return BY_CODE[e.code]
  if (
    error instanceof TypeError ||
    (typeof e.message === 'string' && /fetch|network/i.test(e.message))
  ) {
    return 'db.network'
  }
  return 'db.unknown'
}
