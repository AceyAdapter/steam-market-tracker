FROM node:18-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Install dependencies (--ignore-scripts to skip prebuilt binaries)
# Then rebuild better-sqlite3 for Alpine
RUN npm ci --only=production --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    npm cache clean --force

# Copy source files (node_modules excluded via .dockerignore)
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Create non-root user for security
RUN addgroup -g 1001 -S steamtracker && \
    adduser -S steamtracker -u 1001 && \
    chown -R steamtracker:steamtracker /app

USER steamtracker

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Environment variables
ENV STEAM_TRACKER_DATA=/app/data
ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
