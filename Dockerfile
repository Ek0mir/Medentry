# API ve ingest servisleri icin ortak imaj.
FROM node:22-alpine

WORKDIR /app

# Bagimlilik katmani: kaynak degisince yeniden kurulum yapilmasin.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/protocols/package.json packages/protocols/
COPY packages/domain/package.json packages/domain/
COPY apps/api/package.json apps/api/
COPY apps/ingest/package.json apps/ingest/
COPY apps/simulator/package.json apps/simulator/
COPY apps/web/package.json apps/web/

RUN npm ci --omit=optional --ignore-scripts

COPY tsconfig.base.json tsconfig.json ./
COPY packages packages
COPY apps/api apps/api
COPY apps/ingest apps/ingest
COPY apps/simulator apps/simulator
COPY docs/kvkk docs/kvkk

ENV NODE_ENV=production
USER node

# Varsayilan: API. Ingest icin compose komutu ezer.
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
