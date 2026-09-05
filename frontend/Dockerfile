# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY workers/package.json ./workers/
COPY modules/problem/package.json ./modules/problem/
COPY packages/api-contract/package.json ./packages/api-contract/
RUN npm ci --ignore-scripts

FROM deps AS development
COPY packages/api-contract ./packages/api-contract
COPY frontend ./frontend
COPY modules/problem ./modules/problem
RUN npm run build -w @hackathon/api-contract \
  && chown -R node:node /app
USER node
WORKDIR /app/frontend
ENV API_PROXY_TARGET=http://backend:5000
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS build
COPY packages/api-contract ./packages/api-contract
COPY frontend ./frontend
COPY modules/problem ./modules/problem
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @hackathon/api-contract && npm run build -w frontend

FROM nginxinc/nginx-unprivileged:1.31-alpine AS production
COPY infra/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
