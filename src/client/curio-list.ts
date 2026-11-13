export type ListCurio = {
  id: number
  name: string
  description: string | null
  costCents: number
  dateAcquired: string | null
  relinquished: boolean
  dateRelinquished: string | null
  createdAt: string
  tags: string[]
}

export type ListView = {
  sortKey: 'added' | 'name'
  sortDir: 'asc' | 'desc'
  owned: 'yes' | 'no' | 'either'
  tags: string[]
}

export const defaultView: ListView = { sortKey: 'added', sortDir: 'desc', owned: 'yes', tags: [] }

const byAdded = (a: ListCurio, b: ListCurio) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id
const byName = (a: ListCurio, b: ListCurio) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export function applyView(curios: ListCurio[], view: ListView): ListCurio[] {
  const direction = view.sortDir === 'asc' ? 1 : -1
  const compare = view.sortKey === 'added' ? byAdded : byName
  return curios
    .filter((c) => view.owned === 'either' || c.relinquished === (view.owned === 'no'))
    .filter((c) => view.tags.every((tag) => c.tags.includes(tag)))
    .sort((a, b) => direction * compare(a, b))
}
