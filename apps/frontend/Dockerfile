# Build context must be repo root: docker build -f apps/frontend/Dockerfile .
# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /build

# Preserve ../shared path for Vite alias @shared
COPY apps/shared ./shared
COPY apps/frontend ./frontend

WORKDIR /build/frontend

RUN npm ci

ARG VITE_API_BASE_URL=http://localhost:3000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /build/frontend/dist /usr/share/nginx/html
COPY --from=builder /build/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
