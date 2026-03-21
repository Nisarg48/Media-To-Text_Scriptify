const Media = require('../models/Media');

/**
 * GET /api/analytics/me
 * Per-user usage statistics derived from their Media documents.
 * No heavy aggregation — intended to serve the dashboard summary cards.
 */
const getMyStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [statusCounts, storagePipeline, minutesPipeline] = await Promise.all([
            // Count documents per status
            Media.aggregate([
                { $match: { mediaUploadedBy: require('mongoose').Types.ObjectId.createFromHexString(userId), deletedAt: null } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            // Total storage bytes
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
            // Total minutes processed (lengthMs on COMPLETED media)
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
        });
    } catch (err) {
        console.error('analyticsController.getMyStats:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = { getMyStats };
