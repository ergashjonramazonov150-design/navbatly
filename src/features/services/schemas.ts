import { z } from 'zod'

/** Duration choices offered in the form (DB allows 5–480 minutes). */
export const DURATION_OPTIONS = [10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180] as const

/**
 * Service form. Mirrors the database CHECK constraints (migration 2) so users get a friendly
 * message before saving — the database still enforces the same rules.
 * Messages are translation keys in errors.json ("validation.*").
 */
export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameMin').max(80, 'validation.nameMax'),
  description: z.string().trim().max(300, 'validation.descriptionMax'),
  duration: z.coerce
    .number<string>('validation.durationInvalid')
    .int('validation.durationInvalid')
    .min(5, 'validation.durationInvalid')
    .max(480, 'validation.durationInvalid'),
  // price is typed as digits (formatted on screen); stored as an integer of whole so'm
  price: z
    .string()
    .regex(/^\d{1,9}$/, 'validation.priceRequired')
    .transform(Number),
  isActive: z.boolean(),
})

export type ServiceFormInput = z.input<typeof serviceSchema>
export type ServiceFormValues = z.output<typeof serviceSchema>
