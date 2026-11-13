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

const isSubsequence = (term: string, word: string) => {
  let matched = 0
  for (const ch of word) if (ch === term[matched] && ++matched === term.length) return true
  return false
}

// Substring anywhere, or (for terms of 3+ chars) a subsequence of a single word sharing its first letter.
const termMatches = (term: string, text: string) =>
  text.includes(term) ||
  (term.length >= 3 && text.split(/\W+/).some((word) => word[0] === term[0] && isSubsequence(term, word)))

const matchesQuery = (curio: ListCurio, query: string) => {
  const text = [curio.name, curio.description ?? '', ...curio.tags].join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => termMatches(term, text))
}

const byAdded = (a: ListCurio, b: ListCurio) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id
const byName = (a: ListCurio, b: ListCurio) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export function applyView(curios: ListCurio[], view: ListView, query: string): ListCurio[] {
  const direction = view.sortDir === 'asc' ? 1 : -1
  const compare = view.sortKey === 'added' ? byAdded : byName
  return curios
    .filter((c) => view.owned === 'either' || c.relinquished === (view.owned === 'no'))
    .filter((c) => view.tags.every((tag) => c.tags.includes(tag)))
    .filter((c) => matchesQuery(c, query))
    .sort((a, b) => direction * compare(a, b))
}
