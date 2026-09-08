# Production Dockerfile for Monopoly Network Edition (Version 1 & 2)
FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (clean production install)
RUN npm ci --only=production

# Copy application source code
COPY server/ ./server/
COPY public/ ./public/

# Setup persistent volume directory for saved games
VOLUME ["/app/server/storage/rooms"]

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server/server.js"]
