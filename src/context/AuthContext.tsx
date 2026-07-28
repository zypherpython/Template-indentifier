import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  isGuest: boolean
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, displayName?: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
  enterGuestMode: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (data) {
      setProfile(data as Profile)
    } else {
      // Create a profile row on first sign-in.
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId })
        .select('*')
        .maybeSingle()
      if (created) setProfile(created as Profile)
    }
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => mounted && setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      ;(async () => {
        setSession(sess)
        setIsGuest(false)
        if (sess?.user) {
          await loadProfile(sess.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      })()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isGuest,
    async signInEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUpEmail(email, password, displayName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
      if (data.user) {
        // Email confirmation is OFF, so a session should be returned. If not, sign in.
        if (!data.session) {
          await supabase.auth.signInWithPassword({ email, password })
        }
      }
    },
    async signInGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
      setIsGuest(false)
      setProfile(null)
    },
    enterGuestMode() {
      setIsGuest(true)
      setLoading(false)
    },
    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
