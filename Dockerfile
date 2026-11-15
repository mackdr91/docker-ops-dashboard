# Author: Domonick Mack
# Date: 2026-11-15
# Description: Multi-stage Dockerfile for local containerized development and optimized production deployment.

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssh-client

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Development environment for docker-compose
FROM base AS dev
ENV NODE_ENV=development
ENV PORT=3080
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3080
CMD ["npm", "run", "dev"]

# Stage 3: Build production bundle
FROM base AS builder
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: Production runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3080
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/data

EXPOSE 3080
CMD ["node", "server.js"]
