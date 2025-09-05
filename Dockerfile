# ---- Base build environment ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm install -g turbo && npm ci

# ---- Builder (runs turbo build) ----
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune --scope=api --scope=dashboard --scope=@geofence/mqtt-ingestion --scope=geofence-engine --scope=automation-workers --docker
WORKDIR /app/out
RUN npm install -g turbo && npm ci
COPY . .
RUN turbo run build --filter=api... --filter=dashboard... --filter=@geofence/mqtt-ingestion... --filter=geofence-engine... --filter=automation-workers...

# ---- API Runtime ----
FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /app/out/apps/api/dist ./apps/api/dist
COPY --from=builder /app/out/node_modules ./node_modules
COPY --from=builder /app/out/package.json ./package.json
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# ---- Dashboard Runtime ----
FROM node:20-alpine AS dashboard
WORKDIR /app
COPY --from=builder /app/out/apps/dashboard/.next/standalone ./
COPY --from=builder /app/out/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/out/node_modules ./node_modules
COPY --from=builder /app/out/package.json ./package.json
EXPOSE 3000
CMD ["node", "server.js"]

# ---- MQTT Ingestion Worker ----
FROM node:20-alpine AS mqtt-ingestion
WORKDIR /app
COPY --from=builder /app/out/apps/mqtt-ingestion/dist ./apps/mqtt-ingestion/dist
COPY --from=builder /app/out/node_modules ./node_modules
COPY --from=builder /app/out/package.json ./package.json
CMD ["node", "apps/mqtt-ingestion/dist/index.js"]

# ---- Geofence Engine Worker ----
FROM node:20-alpine AS geofence-engine
WORKDIR /app
COPY --from=builder /app/out/apps/geofence-engine/dist ./apps/geofence-engine/dist
COPY --from=builder /app/out/node_modules ./node_modules
COPY --from=builder /app/out/package.json ./package.json
CMD ["node", "apps/geofence-engine/dist/index.js"]

# ---- Automation Workers ----
FROM node:20-alpine AS automation-workers
WORKDIR /app
COPY --from=builder /app/out/apps/automation-workers/dist ./apps/automation-workers/dist
COPY --from=builder /app/out/node_modules ./node_modules
COPY --from=builder /app/out/package.json ./package.json
CMD ["node", "apps/automation-workers/dist/index.js"]
