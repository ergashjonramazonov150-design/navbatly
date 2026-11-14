/// <reference types="vite/client" />

/** Only PUBLIC values may start with VITE_ — they end up in the browser bundle. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** "true" to show "Parolni unutdingizmi?" — needs custom SMTP (M9). Default: off. */
  readonly VITE_PASSWORD_RESET_ENABLED?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
