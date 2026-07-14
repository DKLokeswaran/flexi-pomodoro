# Multi-stage build: shared → web → server, single runtime image
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN npm run build -w @flexi-pomodoro/shared \
 && npm run build -w @flexi-pomodoro/web \
 && npm run build -w @flexi-pomodoro/server

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3847
ENV WEB_DIST=/app/apps/web/dist
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev -w @flexi-pomodoro/server -w @flexi-pomodoro/shared
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# shared package needs dist entry for node resolution
COPY packages/shared/package.json packages/shared/package.json
WORKDIR /app/apps/server
EXPOSE 3847
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
