# Docker

This project is fully containerized. All services can be run with Docker Compose from the repo root.

## Quick start

1. **Copy env file and set secrets**

   ```bash
   cp .env.example .env
   # Edit .env — at minimum set MONGODB_URL and JWT_SECRET.
   # Optional: GEMINI_API_KEY (translations + summaries), STRIPE_* (billing), GRAFANA_SMTP_* (alerting).
   ```

2. **Build and run the full stack**

   ```bash
   docker compose up --build
   ```

3. **Open the app**

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost | React SPA served by nginx |
| Backend API | http://localhost:5000 | Express REST API |
| MinIO console | http://localhost:9001 | Create bucket `scriptify-dev` here if uploads fail |
| RabbitMQ management | http://localhost:15673 | Default credentials: `guest` / `guest` |
| Prometheus | http://localhost:9090 | Metrics query UI |
| Grafana | http://localhost:3000 | Dashboards (default: `admin` / `admin`) |

**MinIO bucket:** If uploads fail, open the MinIO console (http://localhost:9001) and create a bucket named `scriptify-dev` (or whatever `STORAGE_BUCKET_NAME` is set to in `.env`).

---

## Services

The `docker-compose.yml` defines **7 services** on a shared `scriptify_net` bridge network:

| Service | Image / Build | Role |
|---------|--------------|------|
| `scriptify-frontend` | Built from repo root | React SPA served by nginx on port 80 |
| `scriptify-backend` | Built from `apps/backend` | Express API on `PORT` (default 5000) |
| `scriptify-worker` | Built from `apps/ai_worker` | Python AI worker; no host port |
| `scriptify-rabbitmq` | `rabbitmq:3-management` | Message queue; Prometheus plugin enabled |
| `scriptify-minio` | `minio/minio:latest` | Object storage; browser uploads directly here |
| `scriptify-prometheus` | `prom/prometheus:latest` | Scrapes backend `:5000/metrics` and RabbitMQ `:15692` |
| `scriptify-grafana` | `grafana/grafana:latest` | Pre-provisioned dashboards and alerting |

---

## Image build context

| Service | Build context | Dockerfile |
|---------|--------------|-----------|
| Backend | `apps/backend` | `apps/backend/Dockerfile` |
| Frontend | **repo root** | `apps/frontend/Dockerfile` |
| Worker | `apps/ai_worker` | `apps/ai_worker/Dockerfile` |

The frontend image is built from the repo root so the `@shared` alias (e.g. `apps/shared/languages.json`) is available during `npm run build`.

---

## Build args (frontend)

- `VITE_API_BASE_URL` — API base URL used at **build time** (for the browser). Default in compose: `http://localhost:5000/api`. For production, set this to your real API URL when building the image.

---

## Volumes

MongoDB (external), RabbitMQ, MinIO, Prometheus, and Grafana data are stored in named volumes so they persist across `docker compose down`. To reset everything including volumes:

```bash
docker compose down -v
```

---

## GPU support

For NVIDIA GPU transcription, overlay the GPU compose file:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Or use the launcher scripts (`start.sh` / `start.bat`) which auto-detect GPU availability.

---

## Running a single service

```bash
# Backend only (requires MongoDB, RabbitMQ, MinIO running or configured in .env)
docker compose up scriptify-backend

# Build one image
docker compose build scriptify-worker

# Monitoring only
docker compose up scriptify-prometheus scriptify-grafana
```

---

## Production

Use the same Dockerfiles to build images for your registry. A separate GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and pushes tagged images to Docker Hub:

- `nisarg48/scriptify-backend:latest`
- `nisarg48/scriptify-frontend:latest`
- `nisarg48/scriptify-worker:latest`

Set `NODE_ENV=production` (the backend Dockerfile already does). Set `PORT` in your deployment environment (default `5000`).
