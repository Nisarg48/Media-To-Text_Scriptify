const Media = require('../models/Media');
const Transcript = require('../models/Transcript');
const Summary = require('../models/Summary');
const { resolveSubscription } = require('../controllers/subscriptionController');
const { deleteStoredObjectsForMedia } = require('./mediaStorageCleanup');

const BATCH = 50;

const notDeleted = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };
const missingRetention = { $or: [{ retentionExpiresAt: null }, { retentionExpiresAt: { $exists: false } }] };

/**
 * One-time / idempotent: set retentionExpiresAt from createdAt + plan retention for rows missing it.
 */
async function backfillRetentionExpiresAt() {
    const baseFilter = { $and: [notDeleted, missingRetention] };
    const users = await Media.distinct('mediaUploadedBy', baseFilter);
    let updated = 0;

    for (const userId of users) {
        const sub = await resolveSubscription(String(userId));
        const ms = sub.retentionDays * 86400000;
        const docs = await Media.find({
            mediaUploadedBy: userId,
            $and: [notDeleted, missingRetention],
        }).lean();

        const ops = docs.map((m) => ({
            updateOne: {
                filter: { _id: m._id },
                update: { $set: { retentionExpiresAt: new Date(new Date(m.createdAt).getTime() + ms) } },
            },
        }));

        if (ops.length) {
            await Media.bulkWrite(ops);
            updated += ops.length;
        }
    }

    if (updated) {
        console.log(`retention backfill: set retentionExpiresAt on ${updated} media document(s)`);
    }
}

/**
 * Soft-delete expired media: remove objects from storage, drop transcript/summary rows, set deletedAt.
 */
async function runRetentionPurge() {
    const now = new Date();
    const candidates = await Media.find({
        $and: [
            { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] },
            { retentionExpiresAt: { $ne: null, $lte: now } },
        ],
    })
        .limit(BATCH)
        .exec();

    if (candidates.length === 0) return 0;

    let n = 0;
    for (const media of candidates) {
        try {
            await deleteStoredObjectsForMedia(media);
            await Transcript.deleteMany({ mediaId: media._id });
            await Summary.deleteMany({ mediaId: media._id });
            media.deletedAt = new Date();
            await media.save();
            n += 1;
        } catch (err) {
            console.error('retentionPurgeService: failed for media', media._id, err.message);
        }
    }

    if (n) console.log(`retention purge: soft-deleted ${n} expired media item(s)`);
    return n;
}

module.exports = {
    backfillRetentionExpiresAt,
    runRetentionPurge,
};
