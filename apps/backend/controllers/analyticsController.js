const Media = require('../models/Media');
const { resolveSubscription } = require('./subscriptionController');
const { buildDashboardMediaMatch } = require('../utils/dashboardMediaQuery');
const { firstQueryValue } = require('../utils/mediaPeriodMatch');

/**
 * GET /api/analytics/me
 * Query: periodScope=all|range (optional legacy: omit + periodStart/periodEnd for UTC month).
 * Dashboard should send periodScope explicitly.
 */
const getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const built = buildDashboardMediaMatch(req.query, userId);
        if (built.error) {
            return res.status(built.error.status).json({ msg: built.error.msg });
        }
        const periodMatch = built.match;

        const [statusCounts, storagePipeline, subscription] = await Promise.all([
            Media.aggregate([
                { $match: periodMatch },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Media.aggregate([
                {
                    $match: {
                        $and: [...periodMatch.$and, { sizeBytes: { $gt: 0 } }],
                    },
                },
                { $group: { _id: null, totalBytes: { $sum: '$sizeBytes' } } },
            ]),
            resolveSubscription(userId),
        ]);

        const byStatus = { UPLOADING: 0, UPLOADED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
        statusCounts.forEach(({ _id, count }) => {
            if (_id in byStatus) byStatus[_id] = count;
        });

        const totalFiles = Object.values(byStatus).reduce((a, b) => a + b, 0);
        const storageBytesUsed = storagePipeline[0]?.totalBytes ?? 0;

        res.set('Cache-Control', 'private, no-store');
        return res.json({
            totalFiles,
            byStatus,
            storageBytesUsed,
            subscription,
            period: built.periodEcho,
            periodScope: firstQueryValue(req.query.periodScope) || 'legacy',
        });
    } catch (err) {
        console.error('analyticsController.getMyStats:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = { getMyStats };
