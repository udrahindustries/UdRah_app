# Multi-Stage Production Dockerfile For AirRoute Backend Server
FROM node:20-alpine AS builder

WORKDIR /app

# Install Production Dependencies
COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install Curl For Native Healthchecks
RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

# Create Persistent Data Directory For SQLite Time-Series Database
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "src/server.js"]
