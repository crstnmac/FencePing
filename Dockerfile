# ----------------------------
# 1. Base: install turbo + deps
# ----------------------------
FROM node:20-alpine AS base

WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

# Install dependencies (only root-level first)
RUN npm ci

# ----------------------------
# 2. Prune for production
# ----------------------------
FROM base AS pruner
RUN npx turbo prune \
  --scope=@geofence/api \
  --scope=@geofence/dashboard \
  --scope=@geofence/mqtt-ingestion \
  --scope=@geofence/geofence-engine \
  --scope=@geofence/automation-workers 
# ----------------------------
# 3. Build all apps
# ----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy pruned output
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
COPY --from=pruner /app/out/full/ .

# Install only needed deps
RUN npm ci --omit=dev

# Build all workspaces
RUN npx turbo build --filter=@geofence/api --filter=@geofence/dashboard --filter=@geofence/mqtt-ingestion --filter=@geofence/geofence-engine --filter=@geofence/automation-workers

# ----------------------------
# 4. Runtime: API service
# ----------------------------
FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# ----------------------------
# 5. Runtime: Dashboard (Next.js)
# ----------------------------
FROM node:20-alpine AS dashboard
WORKDIR /app
COPY --from=builder /app/apps/dashboard ./apps/dashboard
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@geofence/dashboard"]

# ----------------------------
# 6. Runtime: MQTT ingestion
# ----------------------------
FROM node:20-alpine AS mqtt-ingestion
WORKDIR /app
COPY --from=builder /app/apps/mqtt-ingestion ./apps/mqtt-ingestion
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "apps/mqtt-ingestion/dist/index.js"]

# ----------------------------
# 7. Runtime: Geofence engine
# ----------------------------
FROM node:20-alpine AS geofence-engine
WORKDIR /app
COPY --from=builder /app/apps/geofence-engine ./apps/geofence-engine
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "apps/geofence-engine/dist/index.js"]

# ----------------------------
# 8. Runtime: Automation workers
# ----------------------------
FROM node:20-alpine AS automation-workers
WORKDIR /app
COPY --from=builder /app/apps/automation-workers ./apps/automation-workers
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "apps/automation-workers/dist/index.js"]
