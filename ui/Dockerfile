# syntax=docker/dockerfile:1.4

FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

# Build the application
RUN pnpm build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Copy and make startup script executable
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Use startup script to handle environment variables and start the server
CMD ["/app/startup.sh"]
