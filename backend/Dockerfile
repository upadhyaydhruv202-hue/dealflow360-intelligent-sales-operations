# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY workers/package.json ./workers/
COPY modules/problem/package.json ./modules/problem/
COPY packages/api-contract/package.json ./packages/api-contract/
COPY database ./database
RUN npm ci --ignore-scripts \
  && npx prisma generate --schema database/prisma/schema.prisma

FROM deps AS development
COPY --chown=node:node packages/api-contract ./packages/api-contract
COPY --chown=node:node backend ./backend
COPY --chown=node:node modules/problem ./modules/problem
COPY --chown=node:node infra/docker ./infra/docker
RUN npm run build -w @hackathon/api-contract \
  && mkdir -p /app/backend/storage /app/backend/job-queue \
  && chown node:node /app/backend/storage /app/backend/job-queue \
  && chown -R node:node /app/packages/api-contract/dist
USER node
ENV NODE_ENV=development \
    HOST=0.0.0.0
EXPOSE 5000
ENTRYPOINT ["node", "/app/infra/docker/backend-entrypoint.cjs"]
CMD ["api"]

FROM deps AS build
COPY packages/api-contract ./packages/api-contract
COPY backend ./backend
COPY modules/problem ./modules/problem
RUN npm run build -w @hackathon/api-contract && npm run build -w @hackathon/problem && npm run build -w backend

FROM node:24-alpine AS production
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY workers/package.json ./workers/
COPY modules/problem/package.json ./modules/problem/
COPY packages/api-contract/package.json ./packages/api-contract/
COPY database ./database
RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate --schema database/prisma/schema.prisma
COPY --from=build --chown=node:node /app/packages/api-contract/dist ./packages/api-contract/dist
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/modules/problem/dist ./modules/problem/dist
COPY --chown=node:node infra/docker ./infra/docker
RUN mkdir -p /app/backend/storage /app/backend/job-queue \
  && chown node:node /app/backend/storage /app/backend/job-queue
USER node
ENV NODE_ENV=production \
    HOST=0.0.0.0
EXPOSE 5000
ENTRYPOINT ["node", "/app/infra/docker/backend-entrypoint.cjs"]
CMD ["api"]
