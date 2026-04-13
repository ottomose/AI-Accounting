FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE ${PORT:-3000}

CMD ["npx", "tsx", "src/index.ts"]
