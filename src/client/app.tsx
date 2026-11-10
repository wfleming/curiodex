import { Router } from 'preact-router'
import { AuthProvider, useAuth } from './auth-context.tsx'
import { AuthPage } from './pages/AuthPage.tsx'
import { CuriosListPage } from './pages/CuriosListPage.tsx'
import { CurioShowPage } from './pages/CurioShowPage.tsx'
import { AdminPage } from './pages/AdminPage.tsx'

function Shell() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <p>Loading…</p>
  if (!user) return <AuthPage />

  return (
    <>
      <nav>
        <a href="/">curiodex</a>
        {user.role === 'admin' && <a href="/admin">Admin</a>}
        <span class="spacer" />
        <span>{user.email}</span>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </nav>
      <Router>
        <CuriosListPage path="/" />
        <CurioShowPage path="/curios/:id" />
        <AdminPage path="/admin" />
      </Router>
    </>
  )
}

export function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
