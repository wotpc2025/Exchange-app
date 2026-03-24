# --- STAGE 1: Base Image ---
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- STAGE 2: Install Dependencies ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- STAGE 3: Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NextAuth & DB variables are loaded at runtime, so no need to bake them in.
RUN npm run build

# --- STAGE 4: Runner (Production Image) ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Copy necessary files for Standalone mode
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]