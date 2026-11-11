/**
 * Feature switches read from VITE_* environment variables (public values only).
 *
 * VITE_PASSWORD_RESET_ENABLED — keep "false" until custom SMTP + a domain exist (M9).
 * Supabase's built-in email only delivers to the project's team members and has a tiny
 * hourly limit, so real owners would never receive the reset link.
 */
export const PASSWORD_RESET_ENABLED = import.meta.env.VITE_PASSWORD_RESET_ENABLED === 'true'
