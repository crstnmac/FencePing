# ----------------------------
# 1. Base: turbo + deps
# ----------------------------
FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

# ----------------------------
# 2. Prune for production
# ----------------------------
FROM base AS pruner
ENV TURBO_DISABLE_DAEMON=1
RUN npx turbo prune \
  --scope=@geofence/api \
  --scope=@geofence/dashboard \
  --scope=@geofence/mqtt-ingestion \
  --scope=@geofence/geofence-engine \
  --scope=@geofence/automation-workers \
  --docker --no-daemon --out-dir=out

# ----------------------------
# 3. Build all apps
# ----------------------------
FROM node:20-alpine AS builder
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1
ENV TURBO_DISABLE_DAEMON=1

COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/full/ ./

RUN npm ci --omit=dev

RUN npx turbo build \
  --filter=@geofence/api \
  --filter=@geofence/dashboard \
  --filter=@geofence/mqtt-ingestion \
  --filter=@geofence/geofence-engine \
  --filter=@geofence/automation-workers \
  --no-daemon

# ----------------------------
# 4. Runtime: API
# ----------------------------
FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules
# prune node_modules to only API deps
RUN npm pkg delete scripts && npm prune --omit=dev
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# ----------------------------
# 5. Runtime: Dashboard (Next.js)
# ----------------------------
FROM node:20-alpine AS dashboard
WORKDIR /app
COPY --from=builder /app/apps/dashboard ./apps/dashboard
COPY --from=builder /app/node_modules ./node_modules
RUN npm pkg delete scripts && npm prune --omit=dev
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@geofence/dashboard"]

# ----------------------------
# 6. Runtime: MQTT ingestion
# ----------------------------
FROM node:20-alpine AS mqtt-ingestion
WORKDIR /app
COPY --from=builder /app/apps/mqtt-ingestion ./apps/mqtt-ingestion
COPY --from=builder /app/node_modules ./node_modules
RUN npm pkg delete scripts && npm prune --omit=dev
CMD ["node", "apps/mqtt-ingestion/dist/index.js"]

# ----------------------------
# 7. Runtime: Geofence engine
# ----------------------------
FROM node:20-alpine AS geofence-engine
WORKDIR /app
COPY --from=builder /app/apps/geofence-engine ./apps/geofence-engine
COPY --from=builder /app/node_modules ./node_modules
RUN npm pkg delete scripts && npm prune --omit=dev
CMD ["node", "apps/geofence-engine/dist/index.js"]

# ----------------------------
# 8. Runtime: Automation workers
# ----------------------------
FROM node:20-alpine AS automation-workers
WORKDIR /app
COPY --from=builder /app/apps/automation-workers ./apps/automation-workers
COPY --from=builder /app/node_modules ./node_modules
RUN npm pkg delete scripts && npm prune --omit=dev
CMD ["node", "apps/automation-workers/dist/index.js"]
