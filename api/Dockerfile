FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Node 25+ no longer bundles Corepack; install the pnpm named by packageManager.
# Only the deps stage and the stages built from it run pnpm.
RUN npm install --global --no-fund --no-audit \
    "$(node -p "require('./package.json').packageManager.split('+')[0]")"
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --filter @auth/api --prod=false --frozen-lockfile

FROM deps AS build
COPY api api
RUN pnpm --filter @auth/api build

FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-workspace.yaml ./
COPY api/package.json api/package.json
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/api/node_modules api/node_modules
COPY --from=build /app/api/dist api/dist
COPY --from=build /app/api/drizzle api/drizzle
WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
