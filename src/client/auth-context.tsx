import { createContext, type ComponentChildren } from 'preact'
import { useCallback, useContext, useEffect, useState } from 'preact/hooks'
import { api } from './api.ts'

export type User = { id: number; email: string; role: 'admin' | 'user'; disabled: boolean }

type AuthState = {
  user: User | null
  registrationEnabled: boolean
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [user, setUser] = useState<User | null>(null)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const res = await api.api.auth.me.$get()
    const data = await res.json()
    setUser(data.user)
    setRegistrationEnabled(data.registrationEnabled)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await api.api.auth.signout.$post()
    await refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, registrationEnabled, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
