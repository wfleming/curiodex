import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, like } from 'drizzle-orm'
import { db } from '../db.ts'
import { curios, tags, curioTags, events, attachments } from '../schema.ts'
import { requireAuth, currentUser, type AuthVariables } from '../auth.ts'
import { saveUpload, deleteUpload, uploadPath } from '../uploads.ts'
import { readFile } from 'node:fs/promises'

const dateString = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date')

const curioInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  costCents: z.number().int(),
  dateAcquired: dateString.optional().nullable(),
  relinquished: z.boolean().default(false),
  dateRelinquished: dateString.optional().nullable(),
  tagNames: z.array(z.string().min(1)).optional(),
})

const curioPatch = curioInput.omit({ tagNames: true }).partial()

const eventInput = z.object({
  date: dateString,
  description: z.string().optional().nullable(),
  costCents: z.number().int(),
})

const eventPatch = eventInput.partial()

async function ownedCurio(curioId: number, userId: number) {
  const [curio] = await db
    .select()
    .from(curios)
    .where(and(eq(curios.id, curioId), eq(curios.userId, userId)))
    .limit(1)
  return curio ?? null
}

async function curioTagList(curioId: number) {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(curioTags)
    .innerJoin(tags, eq(curioTags.tagId, tags.id))
    .where(eq(curioTags.curioId, curioId))
}

function monthlyCostCents(curio: typeof curios.$inferSelect, eventsCostCents: number): number | null {
  if (!curio.dateAcquired) return null
  if (curio.relinquished && !curio.dateRelinquished) return null
  const endDate = curio.relinquished ? curio.dateRelinquished! : new Date()
  const diffDays = (endDate.getTime() - curio.dateAcquired.getTime()) / 86_400_000
  const months = diffDays / 30.4375
  if (months < 1) return null
  return Math.round((curio.costCents + eventsCostCents) / months)
}

async function attachmentOwnerUserId(attachment: typeof attachments.$inferSelect): Promise<number | null> {
  if (attachment.entityType === 'curio') {
    const [curio] = await db.select({ userId: curios.userId }).from(curios).where(eq(curios.id, attachment.entityId)).limit(1)
    return curio?.userId ?? null
  }
  const [event] = await db.select({ curioId: events.curioId }).from(events).where(eq(events.id, attachment.entityId)).limit(1)
  if (!event) return null
  const [curio] = await db.select({ userId: curios.userId }).from(curios).where(eq(curios.id, event.curioId)).limit(1)
  return curio?.userId ?? null
}

export const curioRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get('/', async (c) => {
    const user = currentUser(c)
    const [rows, tagRows, imageRows] = await Promise.all([
      db.select().from(curios).where(eq(curios.userId, user.id)),
      db
        .select({ curioId: curioTags.curioId, name: tags.name })
        .from(curioTags)
        .innerJoin(tags, eq(curioTags.tagId, tags.id))
        .innerJoin(curios, eq(curioTags.curioId, curios.id))
        .where(eq(curios.userId, user.id)),
      db
        .select({ curioId: attachments.entityId, id: attachments.id })
        .from(attachments)
        .innerJoin(curios, and(eq(attachments.entityType, 'curio'), eq(attachments.entityId, curios.id)))
        .where(and(eq(curios.userId, user.id), like(attachments.mimeType, 'image/%')))
        .orderBy(attachments.id),
    ])
    const coverAttachmentId = (curioId: number) => imageRows.find((r) => r.curioId === curioId)?.id ?? null
    const tagNames = (curioId: number) => tagRows.filter((r) => r.curioId === curioId).map((r) => r.name)
    return c.json(rows.map((curio) => ({ ...curio, tags: tagNames(curio.id), coverAttachmentId: coverAttachmentId(curio.id) })))
  })
  .post('/', zValidator('json', curioInput), async (c) => {
    const user = currentUser(c)
    const { tagNames, ...data } = c.req.valid('json')

    const [curio] = await db
      .insert(curios)
      .values({
        userId: user.id,
        name: data.name,
        description: data.description ?? null,
        costCents: data.costCents,
        dateAcquired: data.dateAcquired ? new Date(data.dateAcquired) : null,
        relinquished: data.relinquished || !!data.dateRelinquished,
        dateRelinquished: data.dateRelinquished ? new Date(data.dateRelinquished) : null,
      })
      .returning()
    if (!curio) return c.json({ error: 'failed to create curio' }, 500)

    for (const name of tagNames ?? []) {
      const [tag] = await db.insert(tags).values({ name }).onConflictDoUpdate({ target: tags.name, set: { name } }).returning()
      if (!tag) continue
      await db.insert(curioTags).values({ curioId: curio.id, tagId: tag.id }).onConflictDoNothing()
    }

    return c.json(curio, 201)
  })
  .get('/:id', async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const [curioEvents, curioAttachments, curioTagRows] = await Promise.all([
      db.select().from(events).where(eq(events.curioId, curio.id)),
      db.select().from(attachments).where(and(eq(attachments.entityType, 'curio'), eq(attachments.entityId, curio.id))),
      curioTagList(curio.id),
    ])

    const eventAttachments = await Promise.all(
      curioEvents.map((event) =>
        db.select().from(attachments).where(and(eq(attachments.entityType, 'event'), eq(attachments.entityId, event.id))),
      ),
    )

    const eventsCostCents = curioEvents.reduce((sum, event) => sum + event.costCents, 0)

    return c.json({
      ...curio,
      tags: curioTagRows,
      attachments: curioAttachments,
      events: curioEvents.map((event, i) => ({ ...event, attachments: eventAttachments[i] ?? [] })),
      monthlyCostCents: monthlyCostCents(curio, eventsCostCents),
    })
  })
  .patch('/:id', zValidator('json', curioPatch), async (c) => {
    const user = currentUser(c)
    const id = Number(c.req.param('id'))
    const existing = await ownedCurio(id, user.id)
    if (!existing) return c.json({ error: 'not found' }, 404)

    const patch = c.req.valid('json')
    const [updated] = await db
      .update(curios)
      .set({
        ...patch,
        dateAcquired:
          patch.dateAcquired === null ? null : patch.dateAcquired ? new Date(patch.dateAcquired) : undefined,
        relinquished: patch.dateRelinquished ? true : patch.relinquished,
        dateRelinquished:
          patch.dateRelinquished === null ? null : patch.dateRelinquished ? new Date(patch.dateRelinquished) : undefined,
      })
      .where(eq(curios.id, id))
      .returning()

    return c.json(updated)
  })
  .delete('/:id', async (c) => {
    const user = currentUser(c)
    const id = Number(c.req.param('id'))
    const existing = await ownedCurio(id, user.id)
    if (!existing) return c.json({ error: 'not found' }, 404)

    const curioEvents = await db.select({ id: events.id }).from(events).where(eq(events.curioId, id))
    const entityFilters = [
      and(eq(attachments.entityType, 'curio'), eq(attachments.entityId, id)),
      ...curioEvents.map((event) => and(eq(attachments.entityType, 'event'), eq(attachments.entityId, event.id))),
    ]

    for (const filter of entityFilters) {
      const rows = await db.select().from(attachments).where(filter)
      for (const row of rows) await deleteUpload(row.storedName)
      await db.delete(attachments).where(filter)
    }

    await db.delete(curios).where(eq(curios.id, id))
    return c.body(null, 204)
  })
  .post('/:id/tags', zValidator('json', z.object({ name: z.string().min(1) })), async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const { name } = c.req.valid('json')
    const [tag] = await db.insert(tags).values({ name }).onConflictDoUpdate({ target: tags.name, set: { name } }).returning()
    if (!tag) return c.json({ error: 'failed to create tag' }, 500)
    await db.insert(curioTags).values({ curioId: curio.id, tagId: tag.id }).onConflictDoNothing()
    return c.json(tag, 201)
  })
  .delete('/:id/tags/:tagId', async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    await db
      .delete(curioTags)
      .where(and(eq(curioTags.curioId, curio.id), eq(curioTags.tagId, Number(c.req.param('tagId')))))
    return c.body(null, 204)
  })
  .post('/:id/events', zValidator('json', eventInput), async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const data = c.req.valid('json')
    const [event] = await db
      .insert(events)
      .values({
        curioId: curio.id,
        date: new Date(data.date),
        description: data.description ?? null,
        costCents: data.costCents,
      })
      .returning()
    return c.json(event, 201)
  })
  .patch('/:id/events/:eventId', zValidator('json', eventPatch), async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const patch = c.req.valid('json')
    const [updated] = await db
      .update(events)
      .set({ ...patch, date: patch.date ? new Date(patch.date) : undefined })
      .where(and(eq(events.id, Number(c.req.param('eventId'))), eq(events.curioId, curio.id)))
      .returning()
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })
  .delete('/:id/events/:eventId', async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const eventId = Number(c.req.param('eventId'))
    const filter = and(eq(attachments.entityType, 'event'), eq(attachments.entityId, eventId))
    const rows = await db.select().from(attachments).where(filter)
    for (const row of rows) await deleteUpload(row.storedName)
    await db.delete(attachments).where(filter)

    await db.delete(events).where(and(eq(events.id, eventId), eq(events.curioId, curio.id)))
    return c.body(null, 204)
  })
  .post('/:id/attachments', async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400)

    const { storedName, size } = await saveUpload(file)
    const [attachment] = await db
      .insert(attachments)
      .values({
        entityType: 'curio',
        entityId: curio.id,
        filename: file.name,
        storedName,
        mimeType: file.type || 'application/octet-stream',
        size,
      })
      .returning()
    return c.json(attachment, 201)
  })
  .post('/:id/events/:eventId/attachments', async (c) => {
    const user = currentUser(c)
    const curio = await ownedCurio(Number(c.req.param('id')), user.id)
    if (!curio) return c.json({ error: 'not found' }, 404)

    const eventId = Number(c.req.param('eventId'))
    const [event] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.curioId, curio.id))).limit(1)
    if (!event) return c.json({ error: 'not found' }, 404)

    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400)

    const { storedName, size } = await saveUpload(file)
    const [attachment] = await db
      .insert(attachments)
      .values({
        entityType: 'event',
        entityId: event.id,
        filename: file.name,
        storedName,
        mimeType: file.type || 'application/octet-stream',
        size,
      })
      .returning()
    return c.json(attachment, 201)
  })

export const attachmentRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get('/:id', async (c) => {
    const user = currentUser(c)
    const id = Number(c.req.param('id'))
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
    if (!attachment) return c.json({ error: 'not found' }, 404)

    const ownerId = await attachmentOwnerUserId(attachment)
    if (ownerId !== user.id) return c.json({ error: 'not found' }, 404)

    const buffer = await readFile(uploadPath(attachment.storedName))
    return c.body(buffer, 200, {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.filename)}"`,
    })
  })
  .delete('/:id', async (c) => {
    const user = currentUser(c)
    const id = Number(c.req.param('id'))
    const [attachment] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
    if (!attachment) return c.json({ error: 'not found' }, 404)

    const ownerId = await attachmentOwnerUserId(attachment)
    if (ownerId !== user.id) return c.json({ error: 'not found' }, 404)

    await deleteUpload(attachment.storedName)
    await db.delete(attachments).where(eq(attachments.id, id))
    return c.body(null, 204)
  })
