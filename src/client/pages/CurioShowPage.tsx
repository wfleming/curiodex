import { useEffect, useState } from 'preact/hooks'
import { route } from 'preact-router'
import { api } from '../api.ts'
import { centsToInput, dollarsToCents, formatMoney, formatDate, toDateInput } from '../format.ts'
import { errorMessage } from '../http.ts'
import { checkRelinquished } from '../forms.ts'

type Attachment = { id: number; filename: string }
type EventRow = { id: number; date: string; description: string | null; costCents: number; attachments: Attachment[] }
type Tag = { id: number; name: string }
type Curio = {
  id: number
  name: string
  description: string | null
  costCents: number
  dateAcquired: string | null
  relinquished: boolean
  dateRelinquished: string | null
  tags: Tag[]
  events: EventRow[]
  attachments: Attachment[]
  monthlyCostCents: number | null
}

export function CurioShowPage({ id }: { id?: string; path?: string }) {
  const [curio, setCurio] = useState<Curio | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    const res = await api.api.curios[':id'].$get({ param: { id } })
    if (res.ok) setCurio(await res.json())
  }

  useEffect(() => {
    load()
  }, [id])

  if (!curio) return <p>Loading…</p>

  async function saveEdit(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const dateRelinquished = String(data.get('dateRelinquished') || '') || null
    const relinquished = data.get('relinquished') === 'on' || !!dateRelinquished

    const res = await api.api.curios[':id'].$patch({
      param: { id: String(curio!.id) },
      json: {
        name: String(data.get('name')),
        description: String(data.get('description') || '') || null,
        costCents: dollarsToCents(String(data.get('cost') || '0')),
        dateAcquired: String(data.get('dateAcquired') || '') || null,
        relinquished,
        dateRelinquished,
      },
    })

    if (!res.ok) {
      setError(await errorMessage(res))
      return
    }
    setEditing(false)
    await load()
  }

  async function deleteCurio() {
    if (!confirm(`Delete "${curio!.name}"? This cannot be undone.`)) return
    await api.api.curios[':id'].$delete({ param: { id: String(curio!.id) } })
    route('/')
  }

  async function addTag(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const name = String(data.get('tag') || '').trim()
    if (!name) return
    await api.api.curios[':id'].tags.$post({ param: { id: String(curio!.id) }, json: { name } })
    form.reset()
    await load()
  }

  async function removeTag(tagId: number) {
    await api.api.curios[':id'].tags[':tagId'].$delete({ param: { id: String(curio!.id), tagId: String(tagId) } })
    await load()
  }

  async function addEvent(e: Event) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    const res = await api.api.curios[':id'].events.$post({
      param: { id: String(curio!.id) },
      json: {
        date: String(data.get('date')),
        description: String(data.get('description') || '') || null,
        costCents: dollarsToCents(String(data.get('cost') || '0')),
      },
    })
    if (res.ok) {
      form.reset()
      await load()
    }
  }

  async function deleteEvent(eventId: number) {
    if (!confirm('Delete this event?')) return
    await api.api.curios[':id'].events[':eventId'].$delete({
      param: { id: String(curio!.id), eventId: String(eventId) },
    })
    await load()
  }

  async function uploadCurioAttachment(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const form = new FormData()
    form.set('file', file)
    await fetch(`/api/curios/${curio!.id}/attachments`, { method: 'POST', body: form })
    input.value = ''
    await load()
  }

  async function uploadEventAttachment(eventId: number, file: File) {
    const form = new FormData()
    form.set('file', file)
    await fetch(`/api/curios/${curio!.id}/events/${eventId}/attachments`, { method: 'POST', body: form })
    await load()
  }

  async function deleteAttachment(attachmentId: number) {
    await api.api.attachments[':id'].$delete({ param: { id: String(attachmentId) } })
    await load()
  }

  return (
    <main>
      <p>
        <a href="/">&larr; Curios</a>
      </p>

      {editing ? (
        <form class="card" onSubmit={saveEdit}>
          <label>
            Name
            <input name="name" required defaultValue={curio.name} />
          </label>
          <label>
            Description
            <textarea name="description" defaultValue={curio.description ?? ''} />
          </label>
          <label>
            Cost ($)
            <input name="cost" type="number" step="0.01" defaultValue={centsToInput(curio.costCents)} />
          </label>
          <label>
            Date acquired
            <input name="dateAcquired" type="date" defaultValue={toDateInput(curio.dateAcquired)} />
          </label>
          <label class="checkbox">
            <input name="relinquished" type="checkbox" defaultChecked={curio.relinquished} />
            Relinquished
          </label>
          <label>
            Date relinquished
            <input name="dateRelinquished" type="date" onInput={checkRelinquished} defaultValue={toDateInput(curio.dateRelinquished)} />
          </label>
          {error && <p class="error">{error}</p>}
          <div class="actions">
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div class="card">
          <div class="page-header">
            <h1>{curio.name}</h1>
            <div class="actions">
              <button type="button" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" class="danger" onClick={deleteCurio}>
                Delete
              </button>
            </div>
          </div>
          {curio.description && <p>{curio.description}</p>}
          <dl>
            <dt>Cost</dt>
            <dd>{formatMoney(curio.costCents)}</dd>
            <dt>Acquired</dt>
            <dd>{formatDate(curio.dateAcquired)}</dd>
            <dt>Status</dt>
            <dd>
              {curio.relinquished
                ? `Relinquished${curio.dateRelinquished ? ' ' + formatDate(curio.dateRelinquished) : ''}`
                : 'Active'}
            </dd>
            {curio.monthlyCostCents !== null && (
              <>
                <dt>Monthly cost</dt>
                <dd>{formatMoney(curio.monthlyCostCents)}</dd>
              </>
            )}
          </dl>
          <div class="tags">
            {curio.tags.map((tag) => (
              <span class="tag" key={tag.id}>
                {tag.name}
                <button type="button" onClick={() => removeTag(tag.id)}>
                  ×
                </button>
              </span>
            ))}
            <form class="inline" onSubmit={addTag}>
              <input name="tag" placeholder="add tag" />
              <button type="submit">Add</button>
            </form>
          </div>
          <div class="attachments">
            <h2>Attachments</h2>
            <ul>
              {curio.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                    {a.filename}
                  </a>
                  <button type="button" onClick={() => deleteAttachment(a.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <input type="file" onChange={uploadCurioAttachment} />
          </div>
        </div>
      )}

      <section>
        <h2>Events</h2>
        <ul class="events">
          {curio.events.map((event) => (
            <li key={event.id} class="card">
              <div class="page-header">
                <strong>{formatDate(event.date)}</strong>
                <span>{formatMoney(event.costCents)}</span>
                <button type="button" class="danger" onClick={() => deleteEvent(event.id)}>
                  Delete
                </button>
              </div>
              {event.description && <p>{event.description}</p>}
              <ul>
                {event.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                      {a.filename}
                    </a>
                    <button type="button" onClick={() => deleteAttachment(a.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <input
                type="file"
                onChange={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) uploadEventAttachment(event.id, file)
                }}
              />
            </li>
          ))}
        </ul>

        <form class="card" onSubmit={addEvent}>
          <h3>Add event</h3>
          <label>
            Date
            <input name="date" type="date" required />
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Cost ($) — negative for money received
            <input name="cost" type="number" step="0.01" defaultValue="0" />
          </label>
          <button type="submit">Add event</button>
        </form>
      </section>
    </main>
  )
}
