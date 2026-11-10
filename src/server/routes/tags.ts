import { Hono } from 'hono'
import { db } from '../db.ts'
import { tags } from '../schema.ts'
import { requireAuth, type AuthVariables } from '../auth.ts'

export const tagRoutes = new Hono<{ Variables: AuthVariables }>().use(requireAuth).get('/', async (c) => {
  const rows = await db.select().from(tags)
  return c.json(rows)
})
