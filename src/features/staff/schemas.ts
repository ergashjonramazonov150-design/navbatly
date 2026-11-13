import { z } from 'zod'

/** Barber profile — mirrors staff CHECK constraints (name 2–80, bio ≤ 300). */
export const staffSchema = z.object({
  fullName: z.string().trim().min(2, 'validation.nameMin').max(80, 'validation.nameMax'),
  bio: z.string().trim().max(300, 'validation.descriptionMax'),
})
export type StaffFormValues = z.infer<typeof staffSchema>
