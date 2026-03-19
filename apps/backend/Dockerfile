# Build context must be repo root: docker build -f apps/backend/Dockerfile .
# Backend needs ../../shared/languages.json, so we copy shared and backend into /workspace.
FROM node:20-alpine

WORKDIR /workspace

COPY apps/shared ./shared
COPY apps/backend ./backend

WORKDIR /workspace/backend

ENV NODE_ENV=production

RUN npm ci --omit=dev && chown -R node:node /workspace

USER node

EXPOSE 8080

CMD ["node", "index.js"]
