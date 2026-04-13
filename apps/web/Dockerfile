FROM node:22-slim AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx vite build

FROM node:22-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE ${PORT:-3000}

CMD sh -c "serve -s dist -l tcp://0.0.0.0:${PORT:-3000}"
