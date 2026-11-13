import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db.ts'
import { curios, curioTags, tags } from '../schema.ts'
import { requireAuth, currentUser, type AuthVariables } from '../auth.ts'

export const tagRoutes = new Hono<{ Variables: AuthVariables }>().use(requireAuth).get('/', async (c) => {
  const { id } = currentUser(c)
  const rows = await db
    .selectDistinct({ id: tags.id, name: tags.name })
    .from(tags)
    .innerJoin(curioTags, eq(curioTags.tagId, tags.id))
    .innerJoin(curios, eq(curioTags.curioId, curios.id))
    .where(eq(curios.userId, id))
    .orderBy(tags.name)
  return c.json(rows)
})
