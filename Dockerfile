# Build toolchain for native modules (argon2, better-sqlite3).
FROM node:lts-slim AS toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dev: no deps baked in. Compose mounts the source and a node_modules volume;
# run `npm install` in the container (see `make setup`).
FROM toolchain AS dev
# node_modules must exist and be node-owned so the named volume inherits that.
RUN mkdir node_modules && chown node:node /app /app/node_modules
USER node
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Full deps (incl. dev) for building.
FROM toolchain AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production deps only, compiled here so the final image needs no toolchain.
FROM toolchain AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:lts-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=node:node package.json ./
RUN mkdir uploads && chown node:node /app uploads
USER node
EXPOSE 3000
CMD ["npm", "start"]
