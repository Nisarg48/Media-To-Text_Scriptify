const mongoose = require('mongoose');
const Media = require('../models/Media');
const Transcript = require('../models/Transcript');
const Summary = require('../models/Summary');
const { deleteStoredObjectsForMedia } = require('./mediaStorageCleanup');

/**
 * Remove all of a user's media objects from storage, delete transcript/summary docs,
 * and soft-delete each media row. User row is updated by the caller.
 */
async function purgeUserMediaAndRelatedStorage(userId) {
    const uid = mongoose.Types.ObjectId.createFromHexString(String(userId));
    const mediaList = await Media.find({ mediaUploadedBy: uid });

    for (const media of mediaList) {
        try {
            await deleteStoredObjectsForMedia(media);
            await Transcript.deleteMany({ mediaId: media._id });
            await Summary.deleteMany({ mediaId: media._id });
            media.deletedAt = new Date();
            await media.save();
        } catch (err) {
            console.error('userAccountPurgeService: media', media._id, err.message);
        }
    }
}

module.exports = { purgeUserMediaAndRelatedStorage };
