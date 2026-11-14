import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installFakeSupabase } from '@/test/fakeSupabase'
import type { StaffItem } from './api'
import { DeactivateStaffDialog } from './DeactivateStaffDialog'

const jasur = (photoPath: string | null): StaffItem => ({
  id: 'st-1',
  fullName: 'Jasur',
  bio: null,
  photoPath,
  isActive: true,
  sortOrder: 1,
  serviceIds: [],
  hasLogin: false,
  todayHours: [],
})
const PHOTO =
  '10000000-0000-0000-0000-00000000000a/staff/00000001-0000-4000-8000-000000000001/lg.webp'

const renderDialog = (staff: StaffItem, onConfirm = vi.fn()) => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DeactivateStaffDialog staff={staff} onConfirm={onConfirm} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  return onConfirm
}

beforeEach(() => {
  installFakeSupabase({})
})

describe('Deactivate barber — «Rasmini ham olib tashlash»', () => {
  it('is offered UNTICKED when the barber has a photo; confirming keeps the photo', async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(jasur(PHOTO))
    const box = await screen.findByRole('checkbox', { name: /Rasmini ham olib tashlash/ })
    expect(box).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Nofaol qilish' }))
    expect(onConfirm).toHaveBeenCalledWith(false)
  })

  it('ticked → the photo is removed too', async () => {
    const user = userEvent.setup()
    const onConfirm = renderDialog(jasur(PHOTO))
    await user.click(await screen.findByRole('checkbox', { name: /Rasmini ham olib tashlash/ }))
    await user.click(screen.getByRole('button', { name: 'Nofaol qilish' }))
    expect(onConfirm).toHaveBeenCalledWith(true)
  })

  it('no photo → no checkbox', async () => {
    renderDialog(jasur(null))
    await screen.findByRole('button', { name: 'Nofaol qilish' })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
