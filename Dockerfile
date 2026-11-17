# ── Stage 1: Builder ────────────────────────────────────
FROM node:26-bookworm-slim AS builder

WORKDIR /app

# Install openssl for Prisma and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package manifests and Prisma schema first to leverage layer cache
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including Prisma CLI)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy project files
COPY . .

# ── Stage 2: Runner ─────────────────────────────────────
FROM node:26-bookworm-slim AS runner

WORKDIR /app

# Install runtime deps + dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 appuser && useradd --uid 1001 --gid appuser --shell /bin/sh appuser

# Copy only necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/admin ./admin
COPY --from=builder /app/coach ./coach
COPY --from=builder /app/package*.json ./

# Ensure storage uploads and logs directories exist
RUN mkdir -p uploads logs && chown -R appuser:appuser /app

ENV NODE_ENV=production
ENV PORT=5050

EXPOSE 5050

USER appuser

CMD ["dumb-init", "node", "src/server.js"]
