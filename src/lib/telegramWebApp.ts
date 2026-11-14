/**
 * Telegram Mini App support (booking page opened from the bot's "Yozilish" button).
 * The official script is loaded ONLY when the page was launched by Telegram (it puts
 * tgWebAppData in the URL hash), so normal web visitors never download it.
 * Docs: https://core.telegram.org/bots/webapps
 */
type Btn = {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}
export type TgMainButton = Btn & {
  setParams(p: {
    text?: string
    color?: string
    text_color?: string
    is_active?: boolean
    is_visible?: boolean
  }): void
  showProgress(leaveActive?: boolean): void
  hideProgress(): void
}
export type TelegramWebApp = {
  initData: string
  initDataUnsafe: { user?: { first_name?: string; last_name?: string }; start_param?: string }
  version: string
  ready(): void
  expand(): void
  close(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  setBottomBarColor?(color: string): void
  isVersionAtLeast(v: string): boolean
  BackButton: Btn
  MainButton: TgMainButton
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js'

/** True when Telegram opened this page as a Mini App. */
export const launchedByTelegram = () =>
  typeof window !== 'undefined' && /tgWebAppData=|tgWebAppVersion=/.test(window.location.hash)

let loading: Promise<TelegramWebApp | null> | null = null

export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (!launchedByTelegram()) return Promise.resolve(null)
  if (window.Telegram?.WebApp?.initData) return Promise.resolve(window.Telegram.WebApp)
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => resolve(window.Telegram?.WebApp?.initData ? window.Telegram.WebApp : null)
    s.onerror = () => resolve(null) // booking still works as a normal web page
    document.head.appendChild(s)
  })
  return loading
}

/** Our brand colours inside Telegram (approved: keep cream/terracotta, not the user's theme). */
export const BRAND = { bg: '#f6f1ea', ink: '#1f1b16', onInk: '#fffdf9', surface: '#fffdf9' }
