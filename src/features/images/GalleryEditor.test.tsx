import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { ImageError, processImage } from '@/lib/images/process'
import { fakeProcessed, installFakeSupabase, type LogEntry } from '@/test/fakeSupabase'
import { GalleryEditor } from './GalleryEditor'

vi.mock('@/lib/images/process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/images/process')>()),
  processImage: vi.fn(),
  inspectImage: vi.fn(),
}))

const BIZ = '10000000-0000-0000-0000-00000000000a'
const photo = (n: number) => ({
  id: `p${n}`,
  path: `${BIZ}/gallery/0000000${n % 10}-0000-4000-8000-00000000000${n % 10}/lg.webp`,
})
const files = (n: number) =>
  Array.from({ length: n }, (_, i) => new File(['x'], `ish-${i + 1}.jpg`, { type: 'image/jpeg' }))
const input = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement

let log: LogEntry[]
let onChanged: Mock<() => void>
beforeEach(() => {
  log = installFakeSupabase({})
  onChanged = vi.fn<() => void>()
  vi.mocked(processImage).mockResolvedValue(fakeProcessed())
})

describe('«Ishlarimiz» editor', () => {
  it('7 photos + 8 picked → uploads the 5 that fit and says "5 ta qo\'shildi, 3 tasi sig\'madi"', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <GalleryEditor
        businessId={BIZ}
        photos={[1, 2, 3, 4, 5, 6, 7].map(photo)}
        onChanged={onChanged}
      />,
    )
    expect(screen.getByText('7 / 12')).toBeInTheDocument()
    await user.upload(input(container), files(8))

    expect(
      await screen.findByText("5 ta qo'shildi, 3 tasi sig'madi (limit 12)."),
    ).toBeInTheDocument()
    expect(processImage).toHaveBeenCalledTimes(5)
    const uploads = log.filter((e) => e.kind === 'upload')
    const inserts = log.filter((e) => e.kind === 'db' && e.op === 'insert')
    expect(uploads).toHaveLength(10) // lg + sm for each
    expect(inserts).toHaveLength(5)
    // every file goes into this salon's gallery folder, as lg/sm.webp
    for (const u of uploads) {
      expect(u.kind === 'upload' && u.path).toMatch(
        new RegExp(`^${BIZ}/gallery/[0-9a-f-]{36}/(lg|sm)\\.webp$`),
      )
    }
    expect(onChanged).toHaveBeenCalled()
  })

  it('a photo that fails (too small) is reported, the others are added', async () => {
    vi.mocked(processImage)
      .mockRejectedValueOnce(new ImageError('tooSmall', { w: 300, h: 300, min: 400 }))
      .mockResolvedValueOnce(fakeProcessed())
    const user = userEvent.setup()
    const { container } = render(
      <GalleryEditor businessId={BIZ} photos={[]} onChanged={onChanged} />,
    )
    await user.upload(input(container), files(2))
    expect(
      await screen.findByText(
        "1 ta rasm qo'shildi. 1 tasi yuklanmadi: Rasm juda kichik (300 × 300 px). Kamida 400 × 400 px bo'lgan rasm tanlang.",
      ),
    ).toBeInTheDocument()
  })

  it('if the database says GALLERY_FULL (another tab filled it), the uploaded files are removed again', async () => {
    log = installFakeSupabase({
      dbError: (table, op) =>
        table === 'salon_photos' && op === 'insert'
          ? { code: 'P0001', message: 'GALLERY_FULL' }
          : null,
    })
    const user = userEvent.setup()
    const { container } = render(
      <GalleryEditor businessId={BIZ} photos={[photo(1)]} onChanged={onChanged} />,
    )
    await user.upload(input(container), files(1))
    expect(await screen.findByText(/12 ta rasmdan ko'p bo'lmaydi/)).toBeInTheDocument()
    const up = log
      .filter((e) => e.kind === 'upload')
      .map((e) => (e.kind === 'upload' ? e.path : ''))
    const removed = log.find((e) => e.kind === 'remove')
    expect(removed && removed.kind === 'remove' && removed.paths).toEqual(up) // the same lg + sm
  })

  it('12 photos → "Joy yo\'q", add is off, the limit message shows', () => {
    render(
      <GalleryEditor
        businessId={BIZ}
        photos={Array.from({ length: 12 }, (_, i) => photo(i + 1))}
        onChanged={onChanged}
      />,
    )
    expect(screen.getByText('12 / 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Joy yo'q/ })).toBeDisabled()
    expect(
      screen.getByText(/yangi rasm qo'shish uchun avval bittasini o'chiring/),
    ).toBeInTheDocument()
  })

  it('delete asks first, then: database row → files (lg + sm)', async () => {
    const user = userEvent.setup()
    render(<GalleryEditor businessId={BIZ} photos={[photo(1), photo(2)]} onChanged={onChanged} />)
    await user.click(screen.getByRole('button', { name: "Ish rasmi 2 — o'chirish" }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("O'chgan rasmni qaytarib bo'lmaydi.")).toBeInTheDocument()
    expect(log).toHaveLength(0) // nothing happens before confirming
    await user.click(within(dialog).getByRole('button', { name: "O'chirish" }))
    await waitFor(() => expect(log).toHaveLength(2))
    expect(log[0]).toMatchObject({
      kind: 'db',
      table: 'salon_photos',
      op: 'delete',
      filters: [['eq', 'id', 'p2']],
    })
    expect(log[1]).toEqual({
      kind: 'remove',
      paths: [photo(2).path, photo(2).path.replace('/lg.webp', '/sm.webp')],
    })
  })
})
