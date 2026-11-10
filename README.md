# Curiodex

![](behold-my-stuff.gif)

Track your possessions and what they cost you — purchase price, maintenance,
repairs, eventual sale — over their lifetime.

**LLM vibe-coded for personal use, use at your own risk.**

## Stack

- **Backend**: [Hono](https://hono.dev) on Node, [Drizzle ORM](https://orm.drizzle.team) over
  SQLite
- **Frontend**: [Preact](https://preactjs.com), [preact-router](https://github.com/preactjs/preact-router)
- **Type safety**: TypeScript, Hono RPC (`hono/client`) infers API request/response types directly from the server code.
- **Bundling**: esbuild (JS + CSS)

## Running it

Local dev is Docker Compose based — no local Node/npm install required.

```sh
make setup   # build dev image, npm install into the node_modules volume
make up      # or: docker compose up
```

The dev image contains no dependencies. They live in a named `node_modules`
volume, populated by `npm install` in `make setup`. Re-run `make setup` (or
`docker compose run --rm app npm install`) whenever `package.json` changes.
`docker compose down -v` wipes the volume; run `make setup` again afterwards.

`up` starts the app with esbuild in watch mode (rebuilds + typechecks on
save) at **http://localhost:3000**.

### Production image

```sh
make prod-image
```

Multi-stage: deps are compiled in a toolchain stage, and the final image
carries only prod `node_modules`, `dist/`, `public/` and `drizzle/`.

### First run: apply migrations

The database schema is managed by Drizzle migrations. On a fresh checkout
(or after pulling schema changes), apply them. `make setup` does this; to run
it on its own:

```sh
docker compose run --rm app npm run db:migrate
```

Migrations are never applied on boot. `db:migrate` uses drizzle-orm's runtime
migrator (`scripts/migrate.mjs`), so it also works in the prod image, which
doesn't ship `drizzle-kit`:

```sh
docker run --rm -e DATABASE_URL=/data/curiodex.db -v curiodex-data:/data curiodex npm run db:migrate
```

### First user

The homepage is a sign-in/sign-up form if you're not authenticated. **The
first person to sign up automatically becomes an admin.** Everyone after
that is a regular user, subject to whatever registration policy the admin
has set (see below).

### Admin

Admins get an "Admin" link in the nav, leading to a page where they can:

- enable/disable self-registration site-wide
- view all users
- promote/demote admins
- disable/enable individual user accounts (disabling immediately revokes
  that user's sessions)

Admins cannot disable or demote their own account (to avoid locking
everyone out).

## Development without Docker

If you'd rather run it directly:

```sh
npm install
npm run db:migrate
npm run dev      # esbuild + typecheck in watch mode, serves on :3000
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | One-shot production build; fails if there are type errors |
| `npm run start` | Runs the built server (`dist/server.js`) |
| `npm run typecheck` | Just the type check, no bundling |
| `npm run db:generate` | Generate a new migration from schema changes in `src/server/schema.ts` |
| `npm run db:migrate` | Apply pending migrations (runtime migrator, no drizzle-kit) |
| `npm run db:studio` | Open Drizzle Studio against the local DB |

## Data model

- **Curio** — a possession. Belongs to a user. Has a name, description,
  cost (cents), date acquired, and relinquished status. `relinquished` is a
  boolean independent of `dateRelinquished`, so you can mark something gone
  without necessarily knowing exactly when.
- **Tags** — free-form labels, shared across the whole app, attached to
  curios many-to-many.
- **Events** — things that happen to a curio over time (maintenance,
  repairs, a sale). Has a date, description, and cost in cents — cost can be
  **negative** to represent money received (e.g. selling the item).
- **Attachments** — files attached to either a curio or an event (receipts,
  photos, etc.), stored on disk under `./uploads` (bind-mounted, so they
  persist across container restarts) and served back through an
  authenticated endpoint rather than as public static files.

All money is stored in integer cents to avoid floating-point drift.

### Monthly cost

A curio's detail page shows a **monthly cost**: total spend (the curio's
own cost plus all its events' costs) divided by the number of months
between the acquisition date and either today (if still held) or the
relinquished date (if set). If the curio is marked relinquished but has no
relinquished date recorded, monthly cost isn't shown — there's no end date
to compute it against.

## Project layout

```
src/server/
  schema.ts          Drizzle table definitions
  db.ts               SQLite connection
  auth.ts             password hashing, sessions, auth middleware
  uploads.ts          file storage helpers
  routes/
    auth.ts           signup/signin/signout/me
    curios.ts         curios, tags, events, attachments
    admin.ts          user management, registration toggle
    tags.ts           tag listing
  index.ts            app assembly, static file serving, SPA fallback

src/client/
  api.ts              typed RPC client (hc<AppType>)
  auth-context.tsx     current-user state, used to gate the whole app
  pages/              AuthPage, CuriosListPage, CurioShowPage, AdminPage
  app.tsx             routing + top-level shell
```

## Known limitations

- Currency formatting is hardcoded to USD — fine for now, not a design
  commitment.
- Tags are a single global namespace shared by all users, not per-user.
- UI has not been visually tested in a browser as part of this build — it's
  been exercised end-to-end at the API level (auth, ownership isolation,
  tag/event/attachment CRUD, monthly-cost math, registration toggle,
  session revocation) but worth a manual click-through before relying on it.
