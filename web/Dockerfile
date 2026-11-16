# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc .npmrc
COPY api/package.json api/package.json
COPY web/package.json web/package.json
# pnpm only expands credentials from user-level config, so the registry auth
# line lives in a temporary user config. It holds the literal ${NODE_AUTH_TOKEN};
# the token itself comes from the build secret and is never written to a layer.
RUN --mount=type=secret,id=npm_token,required=true \
    printf '%s\n' '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' > /tmp/registry-auth.npmrc && \
    NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" \
    NPM_CONFIG_USERCONFIG=/tmp/registry-auth.npmrc \
    pnpm install --filter @auth/web --prod=false --frozen-lockfile && \
    rm /tmp/registry-auth.npmrc .npmrc

FROM deps AS build
ARG VITE_AUTH_BASE_URL=
ENV VITE_AUTH_BASE_URL=$VITE_AUTH_BASE_URL
COPY web web
RUN pnpm --filter @auth/web build

FROM scratch AS dist
COPY --from=build /app/web/dist /

FROM caddy:2-alpine AS runtime
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
EXPOSE 80
