import { useEffect, useRef, useState } from 'preact/hooks'
import { api } from '../api.ts'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

const MAX_SUGGESTIONS = 8
const normalize = (s: string) => s.trim().toLowerCase()

/** Text input with tags shown as removable lozenges and typeahead over the user's existing tags. */
export function TagInput({ value, onChange, placeholder = 'add tag' }: Props) {
  const [known, setKnown] = useState<string[]>([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.api.tags
      .$get()
      .then((res) => res.json())
      .then((rows) => setKnown(rows.map((t) => t.name)))
  }, [])

  const query = normalize(text)
  const suggestions = known
    .filter((name) => !value.includes(name) && name.includes(query))
    .sort((a, b) => Number(b.startsWith(query)) - Number(a.startsWith(query)))
    .slice(0, MAX_SUGGESTIONS)

  function commit(raw: string) {
    const tag = normalize(raw)
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setText('')
    setActive(-1)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(suggestions[active] ?? text)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      // -1 means "no suggestion highlighted", so Enter submits the typed text.
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => ((i + 1 + step + suggestions.length + 1) % (suggestions.length + 1)) - 1)
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div class="tag-input" onClick={() => inputRef.current?.focus()}>
      {value.map((tag) => (
        <span class="tag" key={tag}>
          {tag}
          <button type="button" aria-label={`remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={text}
        placeholder={value.length ? '' : placeholder}
        autocapitalize="none"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        enterkeyhint="done"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        onInput={(e) => {
          setText((e.target as HTMLInputElement).value)
          setActive(-1)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (text) commit(text)
          setOpen(false)
        }}
      />
      {open && suggestions.length > 0 && (
        <ul class="suggestions" role="listbox">
          {suggestions.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === active}
              class={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                commit(name)
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
