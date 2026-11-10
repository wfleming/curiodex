import { useState } from 'preact/hooks'
import { api } from '../api.ts'
import { useAuth } from '../auth-context.tsx'
import { errorMessage } from '../http.ts'

export function AuthPage() {
  const { registrationEnabled, refresh } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: Event) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res =
        mode === 'signin'
          ? await api.api.auth.signin.$post({ json: { email, password } })
          : await api.api.auth.signup.$post({ json: { email, password } })
      if (!res.ok) {
        setError(await errorMessage(res))
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="auth-page">
      <h1>curiodex</h1>
      <div class="tabs">
        <button type="button" class={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>
          Sign in
        </button>
        {registrationEnabled && (
          <button type="button" class={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Sign up
          </button>
        )}
      </div>
      <form class="card" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          />
        </label>
        {error && <p class="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
    </main>
  )
}
