# Backend Evolys Export PDF — Node + Python (PyMuPDF) + Chromium (Puppeteer)
FROM node:20-bookworm-slim

# Dépendances système : Python (lecture PDF) + Chromium (génération PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    chromium ca-certificates fonts-liberation \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libpangocairo-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer utilise le Chromium système (pas de téléchargement)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Dépendances Python
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Dépendances Node (inclut tsx pour exécuter le TS)
COPY package*.json ./
RUN npm install

# Code
COPY . .

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "run", "start:server"]
