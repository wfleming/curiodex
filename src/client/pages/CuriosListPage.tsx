import { useEffect, useState } from 'preact/hooks'
import { Link, route } from 'preact-router'
import { api } from '../api.ts'
import { dollarsToCents, formatMoney, formatDate } from '../format.ts'
import { errorMessage } from '../http.ts'
import { checkRelinquished } from '../forms.ts'

type Curio = {
  id: number
  name: string
  costCents: number
  dateAcquired: string | null
  relinquished: boolean
  dateRelinquished: string | null
}

export function CuriosListPage(_props: { path?: string } = {}) {
  const [curios, setCurios] = useState<Curio[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await api.api.curios.$get()
    setCurios(await res.json())
  }

  useEffect(() => {
    load()
  }, [])

  async function createCurio(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const dateRelinquished = String(data.get('dateRelinquished') || '') || null
    const relinquished = data.get('relinquished') === 'on' || !!dateRelinquished
    const tagNames = String(data.get('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const res = await api.api.curios.$post({
      json: {
        name: String(data.get('name')),
        description: String(data.get('description') || '') || null,
        costCents: dollarsToCents(String(data.get('cost') || '0')),
        dateAcquired: String(data.get('dateAcquired') || '') || null,
        relinquished,
        dateRelinquished,
        tagNames,
      },
    })

    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }

    const curio = await res.json()
    route(`/curios/${curio.id}`)
  }

  if (!curios) return <p>Loading…</p>

  return (
    <main>
      <div class="page-header">
        <h1>Curios</h1>
        <button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New curio'}
        </button>
      </div>

      {showForm && (
        <form class="card" onSubmit={createCurio}>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Cost ($)
            <input name="cost" type="number" step="0.01" defaultValue="0" />
          </label>
          <label>
            Date acquired
            <input name="dateAcquired" type="date" />
          </label>
          <label class="checkbox">
            <input name="relinquished" type="checkbox" />
            Relinquished
          </label>
          <label>
            Date relinquished
            <input name="dateRelinquished" type="date" onInput={checkRelinquished} />
          </label>
          <label>
            Tags (comma separated)
            <input name="tags" />
          </label>
          {error && <p class="error">{error}</p>}
          <button type="submit">Create</button>
        </form>
      )}

      {curios.length === 0 ? (
        <p>No curios yet.</p>
      ) : (
        <ul class="curio-list">
          {curios.map((curio) => (
            <li key={curio.id}>
              <Link href={`/curios/${curio.id}`}>{curio.name}</Link>
              <span>{formatMoney(curio.costCents)}</span>
              <span>{formatDate(curio.dateAcquired)}</span>
              {curio.relinquished && <span class="badge">relinquished</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
