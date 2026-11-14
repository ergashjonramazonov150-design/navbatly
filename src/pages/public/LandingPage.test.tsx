import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { LandingPage } from './LandingPage'
import { PrivacyPage } from './PrivacyPage'

// jsdom has no IntersectionObserver (used by lazy images / reveal effects, if any)
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
} as unknown as typeof IntersectionObserver

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LandingPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('Landing page', () => {
  it('shows the headline and links to the demo salon, the bot, privacy and admin', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Mijozlar o'zi")
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/b/demo')
    expect(hrefs).toContain('https://t.me/navbatly_uz_bot?start=demo')
    expect(hrefs).toContain('/privacy')
    expect(hrefs).toContain('/admin/login')
  })

  it('every image has alt text (decorative ones are empty on purpose)', () => {
    renderAt('/')
    for (const img of document.querySelectorAll('img')) {
      expect(img.hasAttribute('alt')).toBe(true)
    }
  })
})

describe('Privacy page', () => {
  it('shows all sections and goes back to the landing page', async () => {
    const router = renderAt('/privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Maxfiylik siyosati')
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
    expect(document.title).toContain('Maxfiylik siyosati')
    await userEvent.setup().click(screen.getByRole('link', { name: /ortga|bosh sahifa/i }))
    expect(router.state.location.pathname).toBe('/')
  })
})
