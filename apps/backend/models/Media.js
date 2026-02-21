const mongoose = require('mongoose');
const StorageSchema = require('./Storage').schema;

const mediaSchema = new mongoose.Schema(
  {
    mediaUploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true },
    sizeBytes: { type: Number, min: 0, required: true },
    lengthMs: { type: Number, min: 0 },
    mediaType: { type: String, enum: ['AUDIO', 'VIDEO'], required: true, index: true },
    format: { type: String, required: true },
    actualLanguage: { type: String },
    status: { type: String, enum: ['UPLOADING', 'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'UPLOADING', index: true },
    
    storage: { type: StorageSchema, required: true },
    derivedAudio: { type: StorageSchema },

    errorDetails: { 
      stage: { type: String },
      message: { type: String },
    },
  },
  { timestamps: true }
);

mediaSchema.index({ mediaUploadedBy: 1, createdAt: -1 });

const Media = mongoose.model('Media', mediaSchema);
module.exports = Media;