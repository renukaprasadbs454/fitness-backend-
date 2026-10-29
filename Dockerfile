FROM node:20-bookworm-slim

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

# Ensure storage uploads and logs directories exist
RUN mkdir -p uploads logs

ENV NODE_ENV=development
ENV PORT=5050

EXPOSE 5050

CMD ["node", "src/server.js"]

