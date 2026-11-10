import { useEffect, useState } from 'preact/hooks'
import { api } from '../api.ts'

type AdminUser = { id: number; email: string; role: 'admin' | 'user'; disabled: boolean; createdAt: string }

export function AdminPage(_props: { path?: string } = {}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)

  async function load() {
    const [usersRes, settingsRes] = await Promise.all([api.api.admin.users.$get(), api.api.admin.settings.$get()])
    setUsers(await usersRes.json())
    setRegistrationEnabled((await settingsRes.json()).registrationEnabled)
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleRegistration() {
    const next = !registrationEnabled
    await api.api.admin.settings.$patch({ json: { registrationEnabled: next } })
    setRegistrationEnabled(next)
  }

  async function toggleDisabled(user: AdminUser) {
    await api.api.admin.users[':id'].$patch({ param: { id: String(user.id) }, json: { disabled: !user.disabled } })
    await load()
  }

  async function toggleRole(user: AdminUser) {
    await api.api.admin.users[':id'].$patch({
      param: { id: String(user.id) },
      json: { role: user.role === 'admin' ? 'user' : 'admin' },
    })
    await load()
  }

  if (!users) return <p>Loading…</p>

  return (
    <main>
      <h1>Admin</h1>
      <label class="checkbox">
        <input type="checkbox" checked={registrationEnabled} onChange={toggleRegistration} />
        Allow self-registration
      </label>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.disabled ? 'disabled' : 'active'}</td>
              <td class="actions">
                <button type="button" onClick={() => toggleRole(user)}>
                  {user.role === 'admin' ? 'Demote' : 'Promote'}
                </button>
                <button type="button" onClick={() => toggleDisabled(user)}>
                  {user.disabled ? 'Enable' : 'Disable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
