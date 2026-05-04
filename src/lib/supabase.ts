import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = supabaseConfigured ? createClient<any>(url!, key!) : null
