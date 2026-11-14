import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createLinkCode, telegramAdmin, unlinkTelegram, type TelegramSettings } from './api'
import { TelegramCard } from './TelegramCard'

/*
 * Sozlamalar → Telegram card. The database / Edge Function calls are faked; their rules are
 * covered by DB test 07 and the curl checks of telegram-admin.
 */
let settings: TelegramSettings
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  useTelegramSettings: () => ({ isPending: false, data: settings }),
  createLinkCode: vi.fn(async () => {}),
  unlinkTelegram: vi.fn(async () => {}),
  setTelegramEnabled: vi.fn(async () => {}),
  telegramAdmin: vi.fn(async () => null),
}))

const notLinked: TelegramSettings = {
  chatTitle: null,
  linked: false,
  isEnabled: false,
  linkedAt: null,
  lastError: null,
}
const linked: TelegramSettings = {
  chatTitle: 'Madara Admin',
  linked: true,
  isEnabled: true,
  linkedAt: '2026-11-14T10:00:00Z',
  lastError: null,
}

beforeEach(() => {
  settings = notLinked
  vi.mocked(telegramAdmin).mockReset().mockResolvedValue(null)
  vi.mocked(createLinkCode).mockClear()
  vi.mocked(unlinkTelegram).mockClear()
})

function renderCard() {
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <TelegramCard businessId="biz-1" slug="demo" />
    </QueryClientProvider>,
  )
}

describe('TelegramCard', () => {
  it('not linked: explains the steps and shows the salon’s customer link', () => {
    renderCard()
    expect(screen.getByText(/@navbatly_uz_bot ochiladi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Botni ulash' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Mijozlar uchun Telegram havola' })).toHaveValue(
      'https://t.me/navbatly_uz_bot?start=demo',
    )
  })

  it('"Botni ulash": sets up the bot, saves a one-time code, opens Telegram, waits', async () => {
    const tab = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderCard()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Botni ulash' }))

    await waitFor(() => expect(createLinkCode).toHaveBeenCalledTimes(1))
    expect(open).toHaveBeenCalledTimes(1) // opened inside the click (no popup blocking)
    expect(telegramAdmin).toHaveBeenCalledWith('setup', 'biz-1')
    const code = vi.mocked(createLinkCode).mock.calls[0][1]
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(tab.location.href).toBe(`https://t.me/navbatly_uz_bot?start=link_${code}`)
    expect(await screen.findByText(/«Start» bosilishi kutilmoqda/)).toBeInTheDocument()
    open.mockRestore()
  })

  it('shows a clear error and closes the empty tab when the bot is not configured', async () => {
    vi.mocked(telegramAdmin).mockResolvedValue('BOT_NOT_CONFIGURED')
    const tab = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderCard()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Botni ulash' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bot hali sozlanmagan')
    expect(tab.close).toHaveBeenCalled()
    expect(createLinkCode).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it('linked: shows the chat, sends a test message and reports the last error', async () => {
    settings = { ...linked, lastError: 'Forbidden: bot was blocked by the user' }
    renderCard()
    expect(screen.getByText(/Ulangan: Madara Admin/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Xabarnomalar yoqilgan' })).toBeChecked()
    expect(screen.getByText(/bot was blocked by the user/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sinov xabarini yuborish' }))
    expect(telegramAdmin).toHaveBeenCalledWith('test', 'biz-1')
    expect(await screen.findByText(/Sinov xabari yuborildi/)).toBeInTheDocument()
  })

  it('"Uzish" asks first, then unlinks', async () => {
    settings = linked
    const user = userEvent.setup()
    renderCard()
    await user.click(screen.getByRole('button', { name: 'Uzish' }))
    const dialog = await screen.findByRole('dialog', { name: "Telegram'ni uzasizmi?" })
    expect(unlinkTelegram).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Uzish' }))
    await waitFor(() => expect(unlinkTelegram).toHaveBeenCalledWith('biz-1'))
  })
})
