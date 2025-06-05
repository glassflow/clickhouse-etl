# syntax=docker/dockerfile:1.4

FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8080
ENV PORT 8080

# Generate env.js at runtime and start the server
CMD sh -c 'echo "window.__ENV__ = { NEXT_PUBLIC_API_URL: \"$NEXT_PUBLIC_API_URL\", NEXT_PUBLIC_IN_DOCKER: \"$NEXT_PUBLIC_IN_DOCKER\" };" > /app/public/env.js && pnpm start'
