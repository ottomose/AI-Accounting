FROM node:22-alpine AS base
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies
RUN npm install --workspace=apps/api --workspace=packages/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build
WORKDIR /app/apps/api
RUN npx tsc || true

EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
