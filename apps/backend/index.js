const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const { createApp } = require('./app');

const app = createApp();

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

connectDB().then(() => {
    const { backfillRetentionExpiresAt, runRetentionPurge } = require('./services/retentionPurgeService');

    if (process.env.SKIP_RETENTION_BACKFILL !== '1') {
        backfillRetentionExpiresAt().catch((e) => console.error('retention backfill:', e.message));
    }
    runRetentionPurge().catch((e) => console.error('retention purge:', e.message));
    setInterval(() => {
        runRetentionPurge().catch((e) => console.error('retention purge:', e.message));
    }, SIX_HOURS_MS);

    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
});

module.exports = app;
