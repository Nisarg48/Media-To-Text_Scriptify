# Operations Guide

This document covers running, observing, and troubleshooting the Docker-based stack.

---

## Compose Files

### `docker-compose.yml`

Base stack — **7 services**:

| Service | Role |
|---------|------|
| `scriptify-frontend` | React SPA served by nginx |
| `scriptify-backend` | Express REST API |
| `scriptify-worker` | Python AI worker (RabbitMQ consumer) |
| `scriptify-rabbitmq` | Message queue with Prometheus plugin |
| `scriptify-minio` | Object storage (browser uploads directly here) |
| `scriptify-prometheus` | Metrics collection (scrapes backend + RabbitMQ) |
| `scriptify-grafana` | Monitoring dashboards and alerting |

### `docker-compose.gpu.yml`

GPU override:

- Adds `runtime: nvidia` to the worker service so Whisper runs on CUDA.

---

## Launchers

### `start.sh` (Linux / macOS)

- Checks whether `nvidia-smi` works and whether host Docker has the NVIDIA runtime.
- If yes → uses host Docker with `docker-compose.gpu.yml` overlay (worker runs on CUDA).
- Otherwise → falls back to CPU mode.

```bash
./start.sh up -d        # start detached
./start.sh logs -f      # follow all logs
./start.sh logs backend -f  # follow a specific service
./start.sh down         # stop and remove containers
```

### `start.bat` (Windows)

Windows equivalent of the same detection and launch logic.

---

## Runtime Modes

### GPU Mode

Conditions:
- NVIDIA GPU is available
- Host Docker supports the NVIDIA runtime

Behavior:
- Launcher uses `docker --context default` (host Docker)
- Worker runs with CUDA
- Containers **will not** appear in Docker Desktop UI (it uses a different daemon)

Check status:

```bash
docker --context default ps
./start.sh logs -f
```

### CPU Mode

Conditions:
- No GPU available to Docker, or Docker Desktop is the only usable daemon

Behavior:
- Launcher uses Docker Desktop daemon (`desktop-linux`) when available
- Worker runs on CPU (slower transcription)
- Containers visible in Docker Desktop UI

---

## Port Mappings

| Service | Host port | Purpose |
|---------|-----------|---------|
| Frontend | `80` | React SPA |
| Backend | `5000` | Express REST API |
| RabbitMQ AMQP | `5673` | Message queue (internal clients use `amqp://rabbitmq:5672`) |
| RabbitMQ Management | `15673` | Web UI (`guest` / `guest`) |
| MinIO API | `9000` | Object storage (browser uploads use this) |
| MinIO Console | `9001` | Admin UI (create buckets, browse objects) |
| Prometheus | `9090` | Metrics query UI |
| Grafana | `3000` | Dashboards and alerting (`admin` / `admin` by default) |

---

## Useful Commands

### Docker context

```bash
docker context show                   # which context is active
docker --context default ps           # containers on host Docker
docker --context desktop-linux ps     # containers on Docker Desktop
```

### Logs

```bash
./start.sh logs -f
./start.sh logs backend -f
./start.sh logs worker -f
./start.sh logs scriptify-prometheus -f
./start.sh logs scriptify-grafana -f
```

### Rebuild

```bash
./start.sh up --build -d
```

### Check backend metrics

```bash
curl http://localhost:5000/metrics     # raw Prometheus text output
```

### Open monitoring

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (default `admin` / `admin`)

---

## Storage Notes

- Original media files and transcript JSON are stored in **MinIO**.
- **MongoDB** stores metadata, status, transcript references, and user/subscription data.
- The backend ensures the MinIO bucket exists at startup.
- Prometheus time-series data is stored in a named Docker volume (`prometheus_data`); default retention is 7 days.
- Grafana state (dashboards, users, alert history) is stored in `grafana_data` volume; dashboards are also provisioned from `monitoring/grafana/dashboards/` on startup.

---

## Queue Notes

- The backend pushes jobs to RabbitMQ after upload finalization.
- The worker consumes one job at a time (`prefetch_count=1`).
- Failed jobs are nack'd and requeued once; a second failure sets status to `FAILED`.
- The worker reconnects to RabbitMQ with exponential backoff on startup.
- RabbitMQ's Prometheus plugin is enabled via `monitoring/rabbitmq/enabled_plugins`; metrics are scraped at `:15692/metrics`.

---

## Common Troubleshooting

### Docker Desktop app shows no containers

Cause: The stack is running on host Docker (`default`); Docker Desktop UI watches a different daemon (`desktop-linux`).

Fix: Use terminal commands to inspect GPU-mode containers, or switch to CPU mode if you specifically need the Docker Desktop UI.

### Backend exits on startup

Likely causes: Invalid `MONGODB_URL`, or MongoDB Atlas / network issue.

```bash
./start.sh logs backend
```

### Worker runs on CPU when GPU exists

```bash
docker --context default info | grep -i nvidia
docker run --rm --runtime=nvidia nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

If that works, `./start.sh up -d` should choose GPU mode automatically.

### Uploads fail (presigned URL errors)

The browser uploads **directly** to MinIO using a presigned URL. The URL contains the host and port that must be reachable from the browser (default: `localhost:9000`). Check:

1. MinIO is running: `docker ps | grep minio`
2. Bucket exists in MinIO console at http://localhost:9001.
3. `STORAGE_PUBLIC_ENDPOINT` in `.env` matches what the browser can reach.

### RabbitMQ or MinIO port conflicts

If host ports are already in use, change them in `.env` or override the `ports` mapping in a local compose override file.

### Grafana shows no data

1. Confirm Prometheus is running: http://localhost:9090/targets — both `scriptify-backend` and `rabbitmq` scrape targets should be `UP`.
2. Check that the backend is serving metrics: `curl http://localhost:5000/metrics`.
3. If Grafana datasource is missing, restart Grafana — provisioning from `monitoring/grafana/provisioning/` runs at startup.

---

## Recommended Daily Workflow

```bash
# 1. Start the full stack
./start.sh up -d

# 2. Follow logs
./start.sh logs -f

# 3. Open the app
#    http://localhost       — frontend
#    http://localhost:3000  — Grafana dashboards

# 4. Stop the stack
./start.sh down
```
