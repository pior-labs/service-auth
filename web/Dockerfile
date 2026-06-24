FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY web/package.json web/package.json
RUN pnpm install --filter @auth/web --prod=false --frozen-lockfile=false

FROM deps AS build
ARG VITE_AUTH_BASE_URL=
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL
COPY web web
RUN pnpm --filter @auth/web build

FROM scratch AS dist
COPY --from=build /app/web/dist /
