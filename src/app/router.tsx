import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

import { AdminLayout } from '@/app/layouts/AdminLayout'
import { PublicLayout } from '@/app/layouts/PublicLayout'
import { RouteErrorScreen } from '@/app/RouteErrorScreen'
import {
  BusinessGate,
  HOME_PATH,
  RedirectIfSignedIn,
  RequireAuth,
  RequireOwner,
} from '@/features/auth/guards'
import { AppointmentsPage } from '@/pages/admin/AppointmentsPage'
import { CalendarPage } from '@/pages/admin/CalendarPage'
import { ForgotPasswordPage } from '@/pages/admin/ForgotPasswordPage'
import { LoginPage } from '@/pages/admin/LoginPage'
import { ResetPasswordPage } from '@/pages/admin/ResetPasswordPage'
import { ServicesPage } from '@/pages/admin/ServicesPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { StaffPage } from '@/pages/admin/StaffPage'
import { LandingPage } from '@/pages/public/LandingPage'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

/*
 * /admin/*  →  RequireAuth  →  BusinessGate (loads salon, blocks inactive / no salon)
 *           →  AdminLayout  →  pages (owner-only pages behind RequireOwner)
 * Routes are added milestone by milestone — see docs/ARCHITECTURE.md §5.
 */
// `gate` is replaceable so tests can provide a fixed salon context instead of Supabase.
export const buildAdminRoutes = (gate: ReactNode = <BusinessGate />): RouteObject[] => [
  {
    path: '/admin/login',
    element: (
      <RedirectIfSignedIn>
        <LoginPage />
      </RedirectIfSignedIn>
    ),
  },
  { path: '/admin/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/admin/reset-password', element: <ResetPasswordPage /> },
  {
    path: '/admin',
    errorElement: <RouteErrorScreen />,
    element: <RequireAuth />,
    children: [
      {
        element: gate,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to={HOME_PATH} replace /> },
              { path: 'appointments', element: <AppointmentsPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              {
                element: <RequireOwner />,
                children: [
                  { path: 'services', element: <ServicesPage /> },
                  { path: 'staff', element: <StaffPage /> },
                  { path: 'settings', element: <SettingsPage /> },
                ],
              },
              { path: '*', element: <Navigate to={HOME_PATH} replace /> },
            ],
          },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter([
  ...buildAdminRoutes(),
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorScreen />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
