import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Don't crash the app — surface a clear error in the UI instead.
  console.error('Missing Supabase env vars. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const EDGE_URLS = {
  analyze: `${url}/functions/v1/analyze-template`,
  composite: `${url}/functions/v1/composite-template`,
}

export function edgeHeaders(sessionToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }
  return headers
}

export function publicStorageUrl(bucket: string, path: string): string {
  return `${url}/storage/v1/object/public/${bucket}/${path}`
}
