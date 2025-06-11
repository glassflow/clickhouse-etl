FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only production dependencies
COPY ./package.json ./pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY ./.next ./.next
COPY ./public ./public
COPY ./next.config.ts ./
COPY ./server.js ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_PUBLIC_IN_DOCKER=true

# Expose the port
EXPOSE 8080

# Copy and make startup script executable
COPY startup.sh /app/startup.sh
RUN chmod +x /app/startup.sh

# Use startup script to handle environment variables and start the server
CMD ["/app/startup.sh"]
