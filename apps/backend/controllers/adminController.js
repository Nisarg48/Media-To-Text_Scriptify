const mongoose = require('mongoose');
const Media = require('../models/Media');
const User = require('../models/User');
const Transcript = require('../models/Transcript');

// @route  GET /api/admin/stats
// @desc   Overview statistics for the admin dashboard
// @access Admin
const getStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalMedia,
            activeMedia,
            deletedMedia,
            failedMedia,
            processingMedia,
            totalTranscripts,
        ] = await Promise.all([
            User.countDocuments(),
            Media.countDocuments(),
            Media.countDocuments({ deletedAt: null }),
            Media.countDocuments({ deletedAt: { $ne: null } }),
            Media.countDocuments({ status: 'FAILED', deletedAt: null }),
            Media.countDocuments({ status: 'PROCESSING', deletedAt: null }),
            Transcript.countDocuments(),
        ]);

        const storagePipeline = await Media.aggregate([
            { $match: { deletedAt: null, sizeBytes: { $ne: null } } },
            { $group: { _id: null, totalBytes: { $sum: '$sizeBytes' } } },
        ]);
        const totalStorageBytes = storagePipeline[0]?.totalBytes || 0;

        const recentUploads = await Media.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('mediaUploadedBy', 'name email')
            .select('filename mediaType status createdAt deletedAt mediaUploadedBy sizeBytes');

        return res.json({
            totalUsers,
            totalMedia,
            activeMedia,
            deletedMedia,
            failedMedia,
            processingMedia,
            totalTranscripts,
            totalStorageBytes,
            recentUploads,
        });
    } catch (err) {
        console.error('adminController.getStats:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  GET /api/admin/media?status=&type=&deleted=&search=&userId=&page=&limit=
// @desc   All media with optional filters and pagination
// @access Admin
const getAllMedia = async (req, res) => {
    try {
        const { status, type, deleted, search, userId, page = 1, limit = 20 } = req.query;

        const query = {};

        if (status && status !== 'all') query.status = status;
        if (type && type !== 'all') query.mediaType = type;

        if (deleted === 'true') {
            query.deletedAt = { $ne: null };
        } else if (deleted === 'false') {
            query.deletedAt = null;
        }
        // If deleted is not specified → show everything (no filter on deletedAt)

        if (search && search.trim()) {
            query.filename = { $regex: search.trim(), $options: 'i' };
        }

        if (userId && userId.trim()) {
            try {
                query.mediaUploadedBy = new mongoose.Types.ObjectId(userId.trim());
            } catch {
                return res.status(400).json({ msg: 'Invalid userId' });
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [media, total] = await Promise.all([
            Media.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('mediaUploadedBy', 'name email'),
            Media.countDocuments(query),
        ]);

        return res.json({ media, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('adminController.getAllMedia:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  GET /api/admin/media/:id
// @desc   Single media detail (including deleted), with transcript metadata
// @access Admin
const getAdminMediaById = async (req, res) => {
    try {
        const media = await Media.findById(req.params.id).populate('mediaUploadedBy', 'name email role');
        if (!media) {
            return res.status(404).json({ msg: 'Media not found' });
        }

        const transcript = await Transcript.findOne({ mediaId: media._id });

        return res.json({ media, transcript: transcript || null });
    } catch (err) {
        console.error('adminController.getAdminMediaById:', err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Media not found' });
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  GET /api/admin/users
// @desc   All users with media counts
// @access Admin
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });

        const userIds = users.map((u) => u._id);
        const mediaCounts = await Media.aggregate([
            { $match: { mediaUploadedBy: { $in: userIds } } },
            {
                $group: {
                    _id: '$mediaUploadedBy',
                    total: { $sum: 1 },
                    active: {
                        $sum: { $cond: [{ $eq: ['$deletedAt', null] }, 1, 0] },
                    },
                },
            },
        ]);

        const countMap = {};
        mediaCounts.forEach((m) => {
            countMap[m._id.toString()] = { total: m.total, active: m.active };
        });

        const usersWithCounts = users.map((u) => ({
            ...u.toObject(),
            mediaCount: countMap[u._id.toString()]?.total || 0,
            activeMediaCount: countMap[u._id.toString()]?.active || 0,
        }));

        return res.json({ users: usersWithCounts });
    } catch (err) {
        console.error('adminController.getAllUsers:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  GET /api/admin/jobs
// @desc   Recent failed and processing jobs (for monitoring)
// @access Admin
const getJobs = async (req, res) => {
    try {
        const jobs = await Media.find({
            status: { $in: ['FAILED', 'PROCESSING'] },
            deletedAt: null,
        })
            .sort({ updatedAt: -1 })
            .limit(50)
            .populate('mediaUploadedBy', 'name email')
            .select('filename status errorDetails createdAt updatedAt mediaUploadedBy mediaType');

        return res.json({ jobs });
    } catch (err) {
        console.error('adminController.getJobs:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  POST /api/admin/media/:id/restore
// @desc   Restore a soft-deleted media record
// @access Admin
const restoreMedia = async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) return res.status(404).json({ msg: 'Media not found' });
        if (!media.deletedAt) return res.status(400).json({ msg: 'Media is not deleted' });

        media.deletedAt = null;
        await media.save();

        return res.json({ msg: 'Media restored successfully', media });
    } catch (err) {
        console.error('adminController.restoreMedia:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = {
    getStats,
    getAllMedia,
    getAdminMediaById,
    getAllUsers,
    getJobs,
    restoreMedia,
};
