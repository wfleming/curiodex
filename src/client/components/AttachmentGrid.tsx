export type GridAttachment = { id: number; filename: string; mimeType: string }

type Props = {
  attachments: GridAttachment[]
  /** Ids marked for removal; shown dimmed. Removal controls only appear when onToggleRemove is set. */
  removing?: number[]
  onToggleRemove?: (id: number) => void
}

export function AttachmentGrid({ attachments, removing = [], onToggleRemove }: Props) {
  return (
    <ul class="thumb-grid">
      {attachments.map((a) => (
        <li key={a.id} class={removing.includes(a.id) ? 'removing' : ''}>
          <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" title={a.filename}>
            {a.mimeType.startsWith('image/') ? (
              <img src={`/api/attachments/${a.id}`} alt={a.filename} loading="lazy" />
            ) : (
              <span>{a.filename}</span>
            )}
          </a>
          {onToggleRemove && (
            <button type="button" class="remove" onClick={() => onToggleRemove(a.id)}>
              {removing.includes(a.id) ? 'Undo' : 'Remove'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
