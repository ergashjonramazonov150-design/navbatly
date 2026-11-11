import { StrictMode } from 'react'
import type { Root } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'

/** Renders the real app. Only loaded after the configuration was validated (see main.tsx). */
export function startApp(root: Root) {
  root.render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}
