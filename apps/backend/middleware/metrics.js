const client = require('prom-client');

const registry = new client.Registry();

client.collectDefaultMetrics({ register: registry, prefix: 'scriptify_' });

const httpRequestDuration = new client.Histogram({
    name: 'scriptify_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
});

const httpRequestsTotal = new client.Counter({
    name: 'scriptify_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
});

function normaliseRoute(req) {
    // Use Express matched route pattern when available; fall back to raw path.
    const matched = req.route ? req.route.path : null;
    if (matched) {
        // Prepend the router mount path so labels stay meaningful.
        const mountPath = req.baseUrl || '';
        return mountPath + matched;
    }
    // For unmatched paths, bucket by prefix to avoid high-cardinality labels.
    const raw = req.path || '/';
    const segments = raw.split('/').slice(0, 3);
    return segments.join('/') || '/';
}

function metricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const route = normaliseRoute(req);
        const labels = { method: req.method, route, status: res.statusCode };
        httpRequestDuration.observe(labels, durationMs);
        httpRequestsTotal.inc(labels);
    });
    next();
}

module.exports = { metricsMiddleware, registry };
