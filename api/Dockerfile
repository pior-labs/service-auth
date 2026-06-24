FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY api/package.json api/package.json
RUN pnpm install --filter @auth/api --prod=false --frozen-lockfile=false

FROM deps AS build
COPY api api
RUN pnpm --filter @auth/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY api/package.json api/package.json
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/api/node_modules api/node_modules
COPY --from=build /app/api/dist api/dist
COPY --from=build /app/api/drizzle api/drizzle
WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
