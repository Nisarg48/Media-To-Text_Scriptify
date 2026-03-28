/**
 * Logs one line per finished /api request for simple latency monitoring.
 * Search logs for prefix "METRIC http".
 */
function apiRequestTiming(req, res, next) {
    if (!req.originalUrl.startsWith('/api')) {
        return next();
    }
    if (req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/health') {
        return next();
    }

    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const path = req.originalUrl.split('?')[0];
        console.log(
            `METRIC http method=${req.method} path=${path} status=${res.statusCode} duration_ms=${durationMs.toFixed(1)}`
        );
    });
    next();
}

module.exports = { apiRequestTiming };
