# Backend Estimation de loyer — Node + Chromium (Puppeteer)
FROM node:20-bookworm-slim

# Chromium systeme pour Puppeteer (pas de telechargement au build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libpangocairo-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Dependances Node (inclut tsx pour executer le TS)
COPY package*.json ./
RUN npm install

# Code
COPY . .

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "run", "start:server"]
