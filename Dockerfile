# Tek imaj: API + derlenmiş panel aynı porttan sunulur.
FROM node:22-alpine AS derle
WORKDIR /uygulama
RUN apk add --no-cache postgresql16-client
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /uygulama
# pg_dump W-15 yedekleme işi için gerekli
RUN apk add --no-cache postgresql16-client tzdata
ENV NODE_ENV=production TZ=Europe/Istanbul
COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/server && npm cache clean --force
COPY --from=derle /uygulama/apps/server/dist apps/server/dist
COPY --from=derle /uygulama/apps/web/dist apps/web/dist
COPY db db
EXPOSE 8080
CMD ["node", "apps/server/dist/index.js"]
