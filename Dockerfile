# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.22.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Nuxt prepare needs application files; run it after copying the source.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm rebuild better-sqlite3 esbuild @parcel/watcher @tailwindcss/oxide vue-demi \
    && pnpm exec nuxt prepare \
    && pnpm build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    DATABASE_URL=/app/data/heirloom.db

# Nitro includes its traced production dependencies, including the native SQLite binary.
COPY --from=build /app/.output ./.output
COPY --from=build /app/.output/server/package.json ./package.json
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY docker/migrate.mjs ./.output/server/migrate.mjs
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/heirloom-entrypoint
RUN mkdir -p /app/data && chown node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/settings/kitchen', { signal: AbortSignal.timeout(4000) }).then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
ENTRYPOINT ["heirloom-entrypoint"]
CMD ["node", ".output/server/index.mjs"]
