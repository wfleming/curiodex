import { readFile } from 'node:fs/promises'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { db } from './db.ts'
import { appSettings } from './schema.ts'
import { attachUser, type AuthVariables } from './auth.ts'
import { authRoutes } from './routes/auth.ts'
import { curioRoutes, attachmentRoutes } from './routes/curios.ts'
import { adminRoutes } from './routes/admin.ts'
import { tagRoutes } from './routes/tags.ts'

await db.insert(appSettings).values({ id: 1, registrationEnabled: true }).onConflictDoNothing()

const app = new Hono<{ Variables: AuthVariables }>()

const api = app
  .use('/api/*', attachUser)
  .route('/api/auth', authRoutes)
  .route('/api/curios', curioRoutes)
  .route('/api/attachments', attachmentRoutes)
  .route('/api/admin', adminRoutes)
  .route('/api/tags', tagRoutes)

export type AppType = typeof api

app.use('/*', serveStatic({ root: './public' }))
app.get('*', async (c) => c.html(await readFile('./public/index.html', 'utf8')))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`listening on http://localhost:${info.port}`)
})
