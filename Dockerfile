FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Install Playwright browser + OS deps after pnpm install so it uses the locked version
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright
RUN pnpm exec playwright install --with-deps chromium

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Persist sent-posts data
VOLUME /app/data

ENV NODE_ENV=production

# Run as non-root user
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser \
    && chown -R appuser:appuser /app
USER appuser

CMD ["node", "dist/index.js"]
