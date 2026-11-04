# Hakku 5.0 — Sovereign Citizen Welfare OS (DPDP volatile-RAM deployment)
FROM node:20-alpine

# Drop privileges: run as unprivileged user
RUN addgroup -S hakku && adduser -S hakku -G hakku

WORKDIR /app

# Install production deps only (express/cors/dotenv — no build step)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App source
COPY server.js matcher.js ./
COPY data ./data
COPY public ./public

# Runtime hardening
ENV NODE_ENV=production
ENV PORT=3000
USER hakku

EXPOSE 3000

# /healthz is the deploy-management probe (sessions count, RSS, uptime)
HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
