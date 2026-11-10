import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db.ts'
import { users, appSettings, sessions } from '../schema.ts'
import { requireAdmin, type AuthVariables } from '../auth.ts'

const updateUserSchema = z.object({
  disabled: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
})

const updateSettingsSchema = z.object({
  registrationEnabled: z.boolean(),
})

export const adminRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAdmin)
  .get('/users', async (c) => {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        disabled: users.disabled,
        createdAt: users.createdAt,
      })
      .from(users)
    return c.json(rows)
  })
  .patch('/users/:id', zValidator('json', updateUserSchema), async (c) => {
    const id = Number(c.req.param('id'))
    const patch = c.req.valid('json')
    const self = c.get('user')!

    if (id === self.id && (patch.disabled === true || patch.role === 'user')) {
      return c.json({ error: 'cannot modify your own account' }, 400)
    }

    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning()
    if (!updated) return c.json({ error: 'not found' }, 404)

    if (patch.disabled === true) {
      await db.delete(sessions).where(eq(sessions.userId, id))
    }

    return c.json({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      disabled: updated.disabled,
      createdAt: updated.createdAt,
    })
  })
  .get('/settings', async (c) => {
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1)
    return c.json({ registrationEnabled: settings?.registrationEnabled ?? true })
  })
  .patch('/settings', zValidator('json', updateSettingsSchema), async (c) => {
    const { registrationEnabled } = c.req.valid('json')
    await db
      .insert(appSettings)
      .values({ id: 1, registrationEnabled })
      .onConflictDoUpdate({ target: appSettings.id, set: { registrationEnabled } })
    return c.json({ registrationEnabled })
  })
