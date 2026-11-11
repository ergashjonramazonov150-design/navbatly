/**
 * The ONE Supabase client for the whole app.
 *
 * Only PUBLIC values are used here (URL + publishable key). They are safe in the browser
 * because Row Level Security protects the data. Secret keys must NEVER appear in frontend
 * code — see docs/ARCHITECTURE.md §7.2.
 *
 * This module is only loaded after main.tsx has checked ENV_PROBLEMS, so the values are
 * known to be valid here (bad values show the configuration error screen instead).
 */
import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database.types'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env'

// Typed with the generated schema (npm run db:types after every migration)
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
