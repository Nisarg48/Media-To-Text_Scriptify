const express = require('express');
const { json } = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');
const adminRoutes = require('./routes/adminRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const { getHealth } = require('./controllers/healthController');
const { authLimiter, apiLimiter } = require('./middleware/rateLimits');
const { apiRequestTiming } = require('./middleware/requestTiming');
const { metricsMiddleware, registry } = require('./middleware/metrics');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(apiRequestTiming);
    app.use(metricsMiddleware);

    // Prometheus metrics — no auth, scraped by Prometheus inside the Docker network
    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
    });

    // Stripe webhook must receive raw body — register before express.json()
    app.use('/api/subscriptions', subscriptionRoutes);

    app.use(json());

    app.get('/api/health', getHealth);

    app.use('/api', apiLimiter);

    app.use('/api/auth', authLimiter, authRoutes);

    app.use('/api/media', mediaRoutes);

    app.use('/api/transcripts', transcriptRoutes);
    app.use('/api/summaries', summaryRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/admin', adminRoutes);

    return app;
}

module.exports = { createApp };
