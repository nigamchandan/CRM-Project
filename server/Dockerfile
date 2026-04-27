# =============================================================================
#  CRM server — production image
#  Node 20 alpine, prod-only deps, non-root user.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force


FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# tini = clean PID 1 signal handling, bash for the entrypoint script
RUN apk add --no-cache tini bash

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/uploads \
 && addgroup -S app && adduser -S app -G app \
 && chown -R app:app /app

USER app

EXPOSE 5000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
