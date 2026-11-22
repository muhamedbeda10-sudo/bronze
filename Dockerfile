# Lotfy Bronze ERP — one image for any server (Coolify, plain Docker).
#   docker build -t lotfy-bronze .
#   docker run -p 3000:3000 -e DATABASE_URL=postgresql://… lotfy-bronze
# The migrations run when the container starts (scripts/docker-start.sh).
# First admin, inside the container:
#   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# the build does not touch the database
RUN npx prisma generate && npx next build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl -fsS -o /dev/null "http://127.0.0.1:${PORT:-3000}/login" || exit 1
CMD ["sh", "scripts/docker-start.sh"]
