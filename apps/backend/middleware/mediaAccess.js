const mongoose = require('mongoose');
const Media = require('../models/Media');

/**
 * Ensures the authenticated user owns the media and it is not soft-deleted.
 * @returns {Promise<import('mongoose').Document | null>} media doc or null after sending 404
 */
async function assertUserOwnsMedia(req, res, mediaId) {
    let oid;
    try {
        oid = new mongoose.Types.ObjectId(mediaId);
    } catch {
        res.status(404).json({ msg: 'Media not found' });
        return null;
    }

    const media = await Media.findOne({
        _id: oid,
        mediaUploadedBy: req.user.id,
    });

    if (!media || media.deletedAt) {
        res.status(404).json({ msg: 'Media not found' });
        return null;
    }

    return media;
}

module.exports = { assertUserOwnsMedia };
