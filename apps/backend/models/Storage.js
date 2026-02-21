const mongoose = require('mongoose');

const StorageSchema = new mongoose.Schema(
    {
        bucket: { type: String, required: true },
        key: { type: String, required: true },
        format: { type: String, required: true },
        sizeBytes: { type: Number, min: 0 },
    },
    { _id: false }
);

const Storage = mongoose.model('Storage', StorageSchema);
module.exports = Storage;