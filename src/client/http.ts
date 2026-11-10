export async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? `request failed (${res.status})`
  } catch {
    return `request failed (${res.status})`
  }
}
