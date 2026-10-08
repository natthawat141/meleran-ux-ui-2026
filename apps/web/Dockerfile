# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /workspace

# Keep all workspace manifests with the single root lockfile for npm ci.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/course-authoring/package.json ./packages/course-authoring/package.json
COPY packages/store/package.json ./packages/store/package.json
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY public ./public
COPY scripts ./scripts
COPY packages ./packages
COPY apps/web ./apps/web
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_API_MODE=remote
ARG VITE_APP_ENV=production
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} VITE_API_MODE=${VITE_API_MODE} VITE_APP_ENV=${VITE_APP_ENV}
RUN npm run build:web

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:15c994d10d6d78658721c3bcafff14cb281fba2a4bdf9d5ba92c416a472516e3 AS runtime
ENV PORT=8080 NGINX_ENVSUBST_FILTER="^PORT$"
COPY containers/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/dist/web/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
