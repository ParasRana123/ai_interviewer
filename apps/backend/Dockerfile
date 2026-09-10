# Production Dockerfile for AI Technical Interviewer Backend
FROM oven/bun:1-alpine AS base

WORKDIR /app

# Copy root workspace and backend package definitions
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma/

# Install dependencies and generate Prisma client
RUN bun install --frozen-lockfile || bun install
RUN cd apps/backend && bun x prisma generate

# Copy backend source code
COPY apps/backend ./apps/backend

# Production environment configuration
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["bun", "run", "index.ts"]
