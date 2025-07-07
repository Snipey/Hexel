# Multi-stage build for Discord Bot
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Expose ports
EXPOSE 3001

# Development command
CMD ["pnpm", "run", "dev"]

# Build stage
FROM base AS builder

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder --chown=bot:nodejs /app/dist ./dist
COPY --from=builder --chown=bot:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=bot:nodejs /app/prisma ./prisma

# Switch to non-root user
USER bot

# Expose ports
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Production command
CMD ["node", "dist/index.js"] 