const express = require('express');
const { json } = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');
const adminRoutes = require('./routes/adminRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const { getHealth } = require('./controllers/healthController');
const { authLimiter, apiLimiter } = require('./middleware/rateLimits');

function createApp() {
    const app = express();

    app.use(cors());
    app.use(json());

    app.get('/api/health', getHealth);

    app.use('/api', apiLimiter);

    app.use('/api/auth', authLimiter, authRoutes);

    app.use('/api/media', mediaRoutes);

    app.use('/api/transcripts', transcriptRoutes);
    app.use('/api/summaries', summaryRoutes);
    app.use('/api/admin', adminRoutes);

    return app;
}

module.exports = { createApp };
