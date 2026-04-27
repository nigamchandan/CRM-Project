# =============================================================================
#  CRM client — Vite build → static nginx
#  No VITE_API_URL is baked in, so the same image works on any host.
#  At runtime, nginx proxies /api, /uploads, /socket.io to the server container.
# =============================================================================

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Empty VITE_API_URL → axios uses relative URLs, nginx handles routing
ENV VITE_API_URL=""
RUN npm run build


FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
