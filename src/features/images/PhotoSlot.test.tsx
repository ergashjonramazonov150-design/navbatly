import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { ImageError, inspectImage, processImage } from '@/lib/images/process'
import { fakeProcessed, installFakeSupabase, type LogEntry } from '@/test/fakeSupabase'
import { saveServicePhoto, saveStaffPhoto } from './api'
import { PhotoSlot } from './PhotoSlot'

vi.mock('@/lib/images/process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/images/process')>()),
  processImage: vi.fn(),
  inspectImage: vi.fn(),
}))

const BIZ = '10000000-0000-0000-0000-00000000000a'
const OLD = `${BIZ}/services/00000001-0000-4000-8000-000000000001/lg.webp`
const OLD_SM = OLD.replace('/lg.', '/sm.')
const file = () => new File(['x'], 'rasm.jpg', { type: 'image/jpeg' })
const input = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement
const labels = {
  upload: 'Rasm yuklash',
  replace: 'Almashtirish',
  remove: 'Olib tashlash',
  saved: 'ok',
  removed: 'ok',
  cropTitle: 'Usta rasmini joylashtiring',
}

let log: LogEntry[]
let onChanged: Mock<() => void>
beforeAll(() => {
  // jsdom has no object URLs (used by the crop window)
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
beforeEach(() => {
  log = installFakeSupabase({})
  onChanged = vi.fn<() => void>()
  vi.mocked(processImage).mockResolvedValue(fakeProcessed())
  vi.mocked(inspectImage).mockResolvedValue({ w: 1000, h: 1000 })
})

const service = (path: string | null) => (
  <PhotoSlot
    businessId={BIZ}
    kind="services"
    path={path}
    save={(p) => saveServicePhoto('svc-1', p)}
    onChanged={onChanged}
    labels={labels}
    preview={(urls) => (urls ? <img src={urls.sm} alt="xizmat" /> : null)}
  />
)

describe('PhotoSlot — order of steps (docs/ARCHITECTURE.md)', () => {
  it('replace: upload lg + sm → save new path → delete the OLD files', async () => {
    const user = userEvent.setup()
    const { container } = render(service(OLD))
    await user.upload(input(container), file())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())

    expect(log.map((e) => (e.kind === 'db' ? `db:${e.table}.${e.op}` : e.kind))).toEqual([
      'upload',
      'upload',
      'db:services.update',
      'remove',
    ])
    const [lg, sm] = log.slice(0, 2).map((e) => (e.kind === 'upload' ? e.path : ''))
    expect(lg).toMatch(new RegExp(`^${BIZ}/services/[0-9a-f-]{36}/lg\\.webp$`))
    expect(sm).toBe(lg.replace('/lg.', '/sm.'))
    expect(log[2]).toMatchObject({ payload: { photo_path: lg }, filters: [['eq', 'id', 'svc-1']] })
    expect(log[3]).toEqual({ kind: 'remove', paths: [OLD, OLD_SM] })
  })

  it('save refused → the NEW files are removed, the old photo stays, error in Uzbek', async () => {
    log = installFakeSupabase({ dbError: () => ({ code: '42501', message: 'permission denied' }) })
    const user = userEvent.setup()
    const { container } = render(service(OLD))
    await user.upload(input(container), file())
    expect(await screen.findByRole('alert')).toHaveTextContent("Sizda bu amal uchun ruxsat yo'q.")
    const uploaded = log
      .filter((e) => e.kind === 'upload')
      .map((e) => (e.kind === 'upload' ? e.path : ''))
    const removes = log.filter((e) => e.kind === 'remove')
    expect(removes).toEqual([{ kind: 'remove', paths: uploaded }]) // only the new ones
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('upload fails (network) → nothing saved, clear message', async () => {
    log = installFakeSupabase({ uploadError: () => ({ message: 'Failed to fetch' }) })
    const user = userEvent.setup()
    const { container } = render(service(OLD))
    await user.upload(input(container), file())
    expect(await screen.findByRole('alert')).toHaveTextContent('Rasm saqlanmadi')
    expect(log.some((e) => e.kind === 'db')).toBe(false)
  })

  it('too small photo → message with the real size, nothing uploaded', async () => {
    vi.mocked(processImage).mockRejectedValue(
      new ImageError('tooSmall', { w: 300, h: 300, min: 400 }),
    )
    const user = userEvent.setup()
    const { container } = render(service(null))
    await user.upload(input(container), file())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Rasm juda kichik (300 × 300 px). Kamida 400 × 400 px bo'lgan rasm tanlang.",
    )
    expect(log).toHaveLength(0)
  })

  it('remove asks first, then: database (null) → files', async () => {
    const user = userEvent.setup()
    render(service(OLD))
    await user.click(screen.getByRole('button', { name: 'Olib tashlash' }))
    const dialog = await screen.findByRole('dialog')
    expect(log).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: "O'chirish" }))
    await waitFor(() => expect(log).toHaveLength(2))
    expect(log[0]).toMatchObject({
      kind: 'db',
      table: 'services',
      op: 'update',
      payload: { photo_path: null },
    })
    expect(log[1]).toEqual({ kind: 'remove', paths: [OLD, OLD_SM] })
  })
})

describe('PhotoSlot — barber photo (crop window)', () => {
  const barber = () => (
    <PhotoSlot
      businessId={BIZ}
      kind="staff"
      path={null}
      save={(p) => saveStaffPhoto('st-1', p)}
      onChanged={onChanged}
      labels={labels}
      preview={() => null}
    />
  )

  it('checks the photo first, then opens the crop window; cancel uploads nothing', async () => {
    const user = userEvent.setup()
    const { container } = render(barber())
    await user.upload(input(container), file())
    const dialog = await screen.findByRole('dialog', { name: 'Usta rasmini joylashtiring' })
    expect(inspectImage).toHaveBeenCalledWith(expect.any(File), 'staff')
    await user.click(within(dialog).getByRole('button', { name: 'Bekor' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(log).toHaveLength(0)
  })

  it('a photo that cannot be opened (e.g. HEIC on a computer) never opens the crop window', async () => {
    vi.mocked(inspectImage).mockRejectedValue(new ImageError('unreadable'))
    const user = userEvent.setup()
    const { container } = render(barber())
    await user.upload(input(container), file())
    expect(await screen.findByRole('alert')).toHaveTextContent("Bu rasmni ochib bo'lmadi.")
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
