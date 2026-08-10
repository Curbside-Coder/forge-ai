import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthContextValue = {
  mode: 'loading' | 'local' | 'supabase'
  user: User | null
  sendMagicLink: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
  updateProfile: (displayName: string, avatarUrl: string) => Promise<string | null>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<AuthContextValue['mode']>(() => (supabase ? 'loading' : 'local'))
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    const initialize = async () => {
      const { data } = await client.auth.getSession()
      if (!active) return
      if (data.session?.user.is_anonymous) {
        await client.auth.signOut()
        setUser(null)
      } else setUser(data.session?.user ?? null)
      setMode('supabase')
    }
    void initialize()
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setMode('supabase')
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])
  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      user,
      sendMagicLink: async (email) => {
        if (!supabase) return 'Supabase is not configured.'
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        return error?.message ?? null
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
      },
      updateProfile: async (displayName, avatarUrl) => {
        if (!supabase) return 'Supabase is not configured.'
        const { data, error } = await supabase.auth.updateUser({
          data: { display_name: displayName.trim(), avatar_url: avatarUrl.trim() },
        })
        if (!error) setUser(data.user)
        return error?.message ?? null
      },
    }),
    [mode, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
