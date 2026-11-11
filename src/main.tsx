import { createRoot } from 'react-dom/client'

import { ConfigErrorScreen } from '@/app/ConfigErrorScreen'
import { ENV_PROBLEMS } from '@/lib/env'
import '@/styles/globals.css'

const root = createRoot(document.getElementById('root')!)

if (ENV_PROBLEMS.length > 0) {
  // Bad VITE_SUPABASE_* values: explain instead of crashing into a blank page.
  console.error('[navbatly] Invalid configuration:', ENV_PROBLEMS)
  root.render(<ConfigErrorScreen problems={ENV_PROBLEMS} />)
} else {
  // The app (and the Supabase client) is loaded only when the configuration is valid.
  void import('@/app/start').then(({ startApp }) => startApp(root))
}
