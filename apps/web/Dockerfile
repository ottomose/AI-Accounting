FROM node:22-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx vite build

FROM node:22-slim

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY server.js ./

CMD ["node", "server.js"]
