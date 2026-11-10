import { useState } from 'preact/hooks'
import { api } from '../api.ts'
import { useAuth } from '../auth-context.tsx'
import { errorMessage } from '../http.ts'

export function ProfilePage(_props: { path?: string } = {}) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setError(null)
    setDone(false)
    setBusy(true)
    try {
      const res = await api.api.auth.password.$post({
        json: { currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')) },
      })
      if (!res.ok) {
        setError(await errorMessage(res))
        return
      }
      form.reset()
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <h1>Profile</h1>
      <p>{user?.email}</p>
      <h2>Change password</h2>
      <form class="card" onSubmit={submit}>
        <label>
          Current password
          <input type="password" name="currentPassword" required autocomplete="current-password" />
        </label>
        <label>
          New password
          <input type="password" name="newPassword" required minLength={8} autocomplete="new-password" />
        </label>
        {error && <p class="error">{error}</p>}
        {done && <p>Password changed.</p>}
        <button type="submit" disabled={busy}>
          Change password
        </button>
      </form>
    </main>
  )
}
