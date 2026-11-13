import { useEffect, useState } from 'preact/hooks'
import { Link, route } from 'preact-router'
import { api } from '../api.ts'
import { dollarsToCents, formatMoney, formatDate } from '../format.ts'
import { errorMessage } from '../http.ts'
import { checkRelinquished } from '../forms.ts'
import { usePersistentState } from '../hooks.ts'
import { applyView, defaultView, type ListCurio, type ListView } from '../curio-list.ts'
import { TagInput } from '../components/TagInput.tsx'

export function CuriosListPage(_props: { path?: string } = {}) {
  const [curios, setCurios] = useState<ListCurio[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagNames, setTagNames] = useState<string[]>([])
  const [view, setView] = usePersistentState<ListView>('curio-list-view', defaultView)
  const [query, setQuery] = useState('')
  const update = (patch: Partial<ListView>) => setView({ ...view, ...patch })

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

  const visible = applyView(curios, view, query)

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
          <div class="field">
            Tags
            <TagInput value={tagNames} onChange={setTagNames} />
          </div>
          {error && <p class="error">{error}</p>}
          <button type="submit">Create</button>
        </form>
      )}

      <input
        class="search"
        type="search"
        placeholder="Search name, description, tags"
        autocapitalize="none"
        autocomplete="off"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />

      <div class="list-controls">
        <label>
          Sort by
          <select value={view.sortKey} onChange={(e) => update({ sortKey: (e.target as HTMLSelectElement).value as ListView['sortKey'] })}>
            <option value="added">Date added</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Order
          <select value={view.sortDir} onChange={(e) => update({ sortDir: (e.target as HTMLSelectElement).value as ListView['sortDir'] })}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <label>
          Owned
          <select value={view.owned} onChange={(e) => update({ owned: (e.target as HTMLSelectElement).value as ListView['owned'] })}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="either">Either</option>
          </select>
        </label>
        <div class="field tag-filter">
          Tags
          <TagInput value={view.tags} onChange={(tags) => update({ tags })} placeholder="filter by tag" />
        </div>
      </div>

      {visible.length === 0 ? (
        <p>{curios.length === 0 ? 'No curios yet.' : 'No curios match.'}</p>
      ) : (
        <ul class="curio-list">
          {visible.map((curio) => (
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
