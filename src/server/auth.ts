import { randomBytes, createHash } from 'node:crypto'
import argon2 from 'argon2'
import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { db } from './db.ts'
import { sessions, users } from './schema.ts'

const SESSION_COOKIE = 'session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type SafeUser = {
  id: number
  email: string
  role: 'admin' | 'user'
  disabled: boolean
}

function toSafeUser(user: typeof users.$inferSelect): SafeUser {
  return { id: user.id, email: user.email, role: user.role, disabled: user.disabled }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    return await argon2.verify(stored, password)
  } catch {
    return false
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  return token
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
}

async function sessionUser(token: string): Promise<SafeUser | null> {
  const id = hashToken(token)
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id))
    return null
  }
  if (row.user.disabled) return null
  return toSafeUser(row.user)
}

export function setSessionCookie(c: import('hono').Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export function clearSessionCookie(c: import('hono').Context) {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

export type AuthVariables = {
  user: SafeUser | null
}

export const attachUser = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  c.set('user', token ? await sessionUser(token) : null)
  await next()
})

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  if (!c.get('user')) return c.json({ error: 'unauthorized' }, 401)
  await next()
})

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  await next()
})

export function currentUser(c: import('hono').Context<{ Variables: AuthVariables }>): SafeUser {
  const user = c.get('user')
  if (!user) throw new Error('currentUser() called without requireAuth')
  return user
}
