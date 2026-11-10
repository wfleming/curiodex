import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'

export function uploadPath(storedName: string): string {
  return path.join(UPLOAD_DIR, storedName)
}

export async function saveUpload(file: File): Promise<{ storedName: string; size: number }> {
  await mkdir(UPLOAD_DIR, { recursive: true })
  const storedName = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(uploadPath(storedName), buffer)
  return { storedName, size: buffer.byteLength }
}

export async function deleteUpload(storedName: string): Promise<void> {
  await unlink(uploadPath(storedName)).catch(() => {})
}
