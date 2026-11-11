import { createBrowserRouter } from 'react-router'

import { PublicLayout } from '@/app/layouts/PublicLayout'
import { LandingPage } from '@/pages/public/LandingPage'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

// Routes are added milestone by milestone — see docs/ARCHITECTURE.md §5.
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
