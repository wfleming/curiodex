import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, count } from 'drizzle-orm'
import { db } from '../db.ts'
import { users, appSettings } from '../schema.ts'
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyUserSessions,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  currentUser,
  type AuthVariables,
} from '../auth.ts'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

async function getRegistrationEnabled(): Promise<boolean> {
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1)
  return settings?.registrationEnabled ?? true
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>()
  .get('/me', async (c) => {
    return c.json({
      user: c.get('user'),
      registrationEnabled: await getRegistrationEnabled(),
    })
  })
  .post('/signup', zValidator('json', credentialsSchema), async (c) => {
    const { email, password } = c.req.valid('json')

    const [userCount] = await db.select({ total: count() }).from(users)
    const isFirstUser = (userCount?.total ?? 0) === 0

    if (!isFirstUser && !(await getRegistrationEnabled())) {
      return c.json({ error: 'registration is disabled' }, 403)
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) return c.json({ error: 'email already in use' }, 409)

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: await hashPassword(password),
        role: isFirstUser ? 'admin' : 'user',
      })
      .returning()
    if (!user) return c.json({ error: 'failed to create user' }, 500)

    const token = await createSession(user.id)
    setSessionCookie(c, token)
    return c.json({ id: user.id, email: user.email, role: user.role, disabled: user.disabled }, 201)
  })
  .post('/signin', zValidator('json', credentialsSchema), async (c) => {
    const { email, password } = c.req.valid('json')

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return c.json({ error: 'invalid email or password' }, 401)
    }
    if (user.disabled) return c.json({ error: 'account disabled' }, 403)

    const token = await createSession(user.id)
    setSessionCookie(c, token)
    return c.json({ id: user.id, email: user.email, role: user.role, disabled: user.disabled })
  })
  .post('/signout', async (c) => {
    const token = getCookie(c, 'session')
    if (token) await destroySession(token)
    clearSessionCookie(c)
    return c.body(null, 204)
  })
  .post('/password', requireAuth, zValidator('json', changePasswordSchema), async (c) => {
    const { currentPassword, newPassword } = c.req.valid('json')
    const { id } = currentUser(c)

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return c.json({ error: 'current password is incorrect' }, 403)
    }

    await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, id))
    await destroyUserSessions(id)
    setSessionCookie(c, await createSession(id))
    return c.body(null, 204)
  })
