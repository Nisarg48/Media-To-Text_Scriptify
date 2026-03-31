const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const Transcript = require('../models/Transcript');

const bucket = () => process.env.STORAGE_BUCKET_NAME;

/**
 * Best-effort delete of main media, derived audio, and transcript JSON in object storage.
 */
async function deleteStoredObjectsForMedia(media) {
    const b = bucket();
    if (!b) return;

    const keys = [];
    if (media.storage?.key) keys.push(media.storage.key);
    if (media.derivedAudio?.key) keys.push(media.derivedAudio.key);

    const transcript = await Transcript.findOne({ mediaId: media._id });
    if (transcript?.jsonFile?.key) keys.push(transcript.jsonFile.key);

    for (const Key of keys) {
        try {
            await s3Client.send(new DeleteObjectCommand({ Bucket: b, Key }));
        } catch (err) {
            console.warn(`storage delete warning: ${Key}`, err.message);
        }
    }
}

module.exports = { deleteStoredObjectsForMedia };
