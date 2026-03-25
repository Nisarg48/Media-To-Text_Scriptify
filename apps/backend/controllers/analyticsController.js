const Media = require('../models/Media');
const { resolveSubscription } = require('./subscriptionController');

/**
 * GET /api/analytics/me
 * Per-user usage statistics derived from their Media documents, plus plan/quota info.
 */
const getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [statusCounts, storagePipeline, minutesPipeline, subscription] = await Promise.all([
            Media.aggregate([
                { $match: { mediaUploadedBy: require('mongoose').Types.ObjectId.createFromHexString(userId), deletedAt: null } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Media.aggregate([
                {
                    $match: {
                        mediaUploadedBy: require('mongoose').Types.ObjectId.createFromHexString(userId),
                        deletedAt: null,
                        sizeBytes: { $gt: 0 },
                    },
                },
                { $group: { _id: null, totalBytes: { $sum: '$sizeBytes' } } },
            ]),
            Media.aggregate([
                {
                    $match: {
                        mediaUploadedBy: require('mongoose').Types.ObjectId.createFromHexString(userId),
                        deletedAt: null,
                        status: 'COMPLETED',
                        lengthMs: { $gt: 0 },
                    },
                },
                { $group: { _id: null, totalMs: { $sum: '$lengthMs' } } },
            ]),
            resolveSubscription(userId),
        ]);

        const byStatus = { UPLOADING: 0, UPLOADED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
        statusCounts.forEach(({ _id, count }) => {
            if (_id in byStatus) byStatus[_id] = count;
        });

        const totalFiles = Object.values(byStatus).reduce((a, b) => a + b, 0);
        const storageBytesUsed = storagePipeline[0]?.totalBytes ?? 0;
        const processingMinutes = Math.round((minutesPipeline[0]?.totalMs ?? 0) / 60000);

        return res.json({
            totalFiles,
            byStatus,
            storageBytesUsed,
            processingMinutes,
            subscription,
        });
    } catch (err) {
        console.error('analyticsController.getMyStats:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = { getMyStats };
