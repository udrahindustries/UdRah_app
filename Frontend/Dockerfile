# Multi-Stage Production Dockerfile For AirRoute React Client & Nginx Gateway
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Nginx Edge Reverse Proxy
FROM nginx:1.27-alpine AS runner

# Remove Default Configuration
RUN rm -rf /etc/nginx/conf.d/default.conf

# Install Wget For Coolify Native Healthcheck Probes
RUN apk add --no-cache wget

# Copy Built React Distribution Assets
COPY --from=builder /app/Dist /usr/share/nginx/html

# Copy Edge Nginx Configuration
COPY Nginx.conf /etc/nginx/conf.d/default.conf

# Expose Internal Port 80 Per Coolify Coding Standards
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
