import { z } from 'zod'

/** Dropdown choices, as in the approved mockup. The database allows these (and a bit more). */
export const STEP_OPTIONS = [5, 10, 15, 20, 30, 60] as const
export const HORIZON_OPTIONS = [7, 14, 30, 60, 90] as const
export const NOTICE_OPTIONS = [0, 30, 60, 120, 180, 1440] as const
export const MAX_PER_PHONE_OPTIONS = [1, 2, 3, 5, 10] as const

/**
 * The options list, plus the salon's current value if it isn't one of them
 * (e.g. the platform admin set 45 days) — so the dropdown never shows a wrong value.
 */
export const withCurrent = (options: readonly number[], current: number) =>
  options.includes(current) ? [...options] : [...options, current].sort((a, b) => a - b)

const choice = z.coerce.number<string>().int().nonnegative()

/**
 * Sozlamalar form. Mirrors the database CHECK constraints (migration 2) for friendly
 * messages; the database still enforces them. Messages are keys in errors.json.
 */
export const settingsSchema = z.object({
  name: z.string().trim().min(2, 'validation.salonNameMin').max(100, 'validation.salonNameMax'),
  // the 9 digits after +998; empty = no public phone
  phone: z.string().regex(/^(\d{9})?$/, 'validation.phoneInvalid'),
  address: z.string().trim().max(200, 'validation.addressMax'),
  slotStep: choice,
  horizonDays: choice,
  noticeMinutes: choice,
  maxPerPhone: choice,
  autoConfirm: z.boolean(),
})

export type SettingsFormInput = z.input<typeof settingsSchema>
export type SettingsFormValues = z.output<typeof settingsSchema>
