import { z } from 'zod'

// Error messages are translation keys in errors.json ("validation.*"); forms translate them.

const email = z
  .string()
  .trim()
  .min(1, 'validation.emailRequired')
  .pipe(z.email('validation.emailInvalid'))

export const loginSchema = z.object({
  email,
  // Login only checks "not empty": the length rule is enforced when a password is SET.
  password: z.string().min(1, 'validation.passwordRequired'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z
  .object({
    password: z.string().min(8, 'validation.passwordMin'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'validation.passwordMismatch',
  })
export type ResetValues = z.infer<typeof resetSchema>
