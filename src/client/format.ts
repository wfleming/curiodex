export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function dollarsToCents(value: string): number {
  return Math.round(parseFloat(value || '0') * 100)
}

export function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}
