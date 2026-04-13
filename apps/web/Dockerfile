FROM node:22-alpine AS base
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies
RUN npm install --workspace=apps/web --workspace=packages/shared

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Build
WORKDIR /app/apps/web
RUN npm run build

# Serve
FROM node:22-alpine AS runner
RUN npm install -g serve
COPY --from=base /app/apps/web/dist /app/dist
WORKDIR /app

EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
