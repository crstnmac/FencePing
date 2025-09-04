FROM node:20-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Install dependencies
RUN npm ci

FROM base AS api
WORKDIR /app
EXPOSE 3001
CMD ["npm", "run", "dev:api"]

FROM base AS dashboard  
WORKDIR /app
EXPOSE 3000
CMD ["npm", "run", "dev:dashboard"]

FROM base AS mqtt-ingestion
WORKDIR /app
CMD ["npm", "run", "dev", "--workspace=@geofence/mqtt-ingestion"]

FROM base AS geofence-engine
WORKDIR /app
CMD ["npm", "run", "dev:geofence-engine"]

FROM base AS automation-workers
WORKDIR /app
CMD ["npm", "run", "dev:automation-workers"]