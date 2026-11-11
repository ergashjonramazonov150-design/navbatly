/**
 * The ONE Supabase client for the whole app.
 *
 * Only PUBLIC values are used here (URL + publishable/anon key).
 * They are safe in the browser because Row Level Security protects the data.
 * Secret keys must NEVER appear in frontend code — see docs/ARCHITECTURE.md §7.2.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

// TODO(M1): add the generated `Database` type: createClient<Database>(...)
export const supabase = createClient(supabaseUrl, supabasePublishableKey)
