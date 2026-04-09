# Monitoring Guide (Prometheus + Grafana)

Scriptify ships an observability stack alongside the application services. It starts automatically with `docker compose up` — no manual setup required.

---

## Overview

| Component | Role | Host port |
|-----------|------|-----------|
| **Prometheus** | Scrapes and stores time-series metrics | `9090` |
| **Grafana** | Visualises metrics, provides dashboards and alerting | `3000` |

Prometheus pulls metrics from two sources:

1. **Backend API** — `/metrics` endpoint (Prometheus text format via `prom-client`)
2. **RabbitMQ** — `:15692/metrics` (built-in Prometheus plugin)

Grafana reads from Prometheus and displays three pre-provisioned dashboards.

---

## Quick access

After `docker compose up`:

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 — default credentials `admin` / `admin` (change on first login)

---

## What is instrumented

### Backend (Node.js / Express)

Two middleware files handle instrumentation:

- **`apps/backend/middleware/metrics.js`** — creates `prom-client` counters and histograms with a `scriptify_` prefix:
  - HTTP request counter (by method, route, status code)
  - HTTP request duration histogram (latency buckets)
  - Active request gauge
- **`apps/backend/middleware/requestTiming.js`** — per-request timing; skips the `/api/health` probe endpoint to avoid noise.

All metrics are exposed at `GET /metrics` on the backend's port (`5000` by default). This endpoint is unauthenticated (Prometheus needs to scrape it without credentials) but returns only numeric telemetry.

### RabbitMQ

The `rabbitmq_prometheus` plugin is enabled via `monitoring/rabbitmq/enabled_plugins`. It exposes queue depth, consumer counts, publish rates, deliver rates, and more at `:15692/metrics`. No additional configuration is needed.

---

## Prometheus configuration

**File:** `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: scriptify-backend
    static_configs:
      - targets: ['scriptify-backend:5000']
    metrics_path: /metrics

  - job_name: rabbitmq
    static_configs:
      - targets: ['scriptify-rabbitmq:15692']
```

Key settings:
- Scrape interval: **15 seconds** (balance between freshness and storage cost).
- Data retention: **7 days** (set via `--storage.tsdb.retention.time=7d` in compose).
- Data volume: stored in the `prometheus_data` Docker named volume.

---

## Grafana dashboards

Dashboards are provisioned at startup from `monitoring/grafana/dashboards/`. They appear in Grafana without any manual import.

### `api-http.json` — API HTTP Metrics

Panels:
- Total request rate (req/s by route)
- HTTP latency percentiles (p50, p95, p99)
- Error rate (4xx and 5xx by route)
- Request count over time

Use this dashboard to identify slow or failing routes and to observe traffic patterns.

### `nodejs-runtime.json` — Node.js Runtime

Panels:
- Heap used / heap total
- Event loop lag
- Garbage collection activity
- Active handles and requests

Use this dashboard to spot memory leaks, GC pressure, or event loop saturation.

### `rabbitmq.json` — RabbitMQ Queue

Panels:
- Messages ready (queue depth)
- Consumer count
- Publish rate (messages/s entering the queue)
- Deliver rate (messages/s being processed by the worker)

Use this dashboard to monitor job backlog and worker throughput. A growing queue depth with no consumers usually means the worker is down.

---

## Grafana provisioning structure

```
monitoring/
  prometheus.yml                              ← Prometheus scrape config
  rabbitmq/
    enabled_plugins                           ← Enables rabbitmq_prometheus plugin
  grafana/
    provisioning/
      datasources/
        prometheus.yml                        ← Registers Prometheus as a datasource
      dashboards/
        dashboard.yml                         ← Tells Grafana where to find dashboard JSON
      alerting/
        contact-points.yaml                   ← Email contact point definition
        notification-policies.yaml           ← Routes alerts to contact points
    dashboards/
      api-http.json
      nodejs-runtime.json
      rabbitmq.json
```

---

## Alerting

Grafana can send email alerts when metrics cross thresholds.

### Configuration

SMTP settings are passed to the Grafana container via environment variables (set in `.env`, see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `GRAFANA_SMTP_HOST` | SMTP server and port, e.g. `smtp.gmail.com:587` |
| `GRAFANA_SMTP_USER` | SMTP username / email address |
| `GRAFANA_SMTP_PASSWORD` | SMTP password or app-specific password |
| `GRAFANA_PASSWORD` | Grafana admin password (default: `admin`) |

### Provisioned alert resources

- **`contact-points.yaml`** — defines an email contact point named `email-alerts`.
- **`notification-policies.yaml`** — routes all alerts to `email-alerts` by default.

To add a new alert rule: open Grafana → Alerting → Alert Rules → New rule. Point it at any panel metric and assign the notification policy. The contact point and policy are already provisioned.

---

## Adding a new metric

1. In `apps/backend/middleware/metrics.js`, register a new `prom-client` metric (counter, gauge, or histogram) with a `scriptify_` prefix.
2. In the relevant controller or service, call `.inc()`, `.set()`, or `.observe()` on the metric object.
3. Prometheus will automatically pick it up on the next scrape (within 15 s).
4. In Grafana, use **Explore** (http://localhost:3000/explore) to write a PromQL query and verify the data, then add a panel to the relevant dashboard.

---

## Troubleshooting

### Prometheus targets show "DOWN"

Open http://localhost:9090/targets. If a target is `DOWN`:

- **Backend target:** Check `docker ps` — is `scriptify-backend` running? Test `curl http://localhost:5000/metrics` from the host.
- **RabbitMQ target:** Confirm `scriptify-rabbitmq` is running and the Prometheus plugin is enabled. Check `monitoring/rabbitmq/enabled_plugins` contains `rabbitmq_prometheus`.

### Grafana shows "No data"

1. Confirm both Prometheus targets are `UP` (see above).
2. In Grafana → Configuration → Data Sources, check the Prometheus datasource status.
3. Restart Grafana if the datasource is missing — provisioning runs at container startup.

### High queue depth on RabbitMQ dashboard

The worker is likely down or processing very slowly. Check:

```bash
docker ps | grep worker
./start.sh logs worker -f
```

If the worker has crashed, restart it:

```bash
docker compose restart scriptify-worker
```
