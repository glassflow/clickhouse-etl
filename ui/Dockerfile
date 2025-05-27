# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy necessary files from builder
COPY ./package.json ./pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

COPY ./.next ./.next
COPY ./public ./public
COPY ./next.config.ts ./
COPY ./server.js ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_IN_DOCKER=true

# Expose the port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
