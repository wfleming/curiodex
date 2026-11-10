// Setting a relinquished date implies the item is relinquished.
export function checkRelinquished(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.value) return
  const box = input.form?.elements.namedItem('relinquished') as HTMLInputElement | null
  if (box) box.checked = true
}
