const mongoose = require('mongoose');
const StorageSchema = require('./Storage').schema;

const mediaSchema = new mongoose.Schema(
  {
    mediaUploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true },
    sizeBytes: { type: Number, min: 0 },
    lengthMs: { type: Number, min: 0 },
    mediaType: { type: String, enum: ['AUDIO', 'VIDEO'], required: true, index: true },
    format: { type: String, required: true },
    
    detectedLanguage: { type: String },
    sourceLanguageMode: { type: String, enum: ['AUTO', 'FORCED'], default: 'AUTO' },
    sourceLanguageCode: { type: String },

    /** Persisted for admin requeue / audit (same value sent to the worker at finalize). */
    targetLanguageCode: { type: String },

    status: { type: String, enum: ['UPLOADING', 'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED'], default: 'UPLOADING', index: true },
    
    storage: { type: StorageSchema, required: true },
    derivedAudio: { type: StorageSchema },

    errorDetails: {
      stage: { type: String },
      message: { type: String },
      userMessage: { type: String },
      attempt: { type: Number },
    },
    deletedAt: { type: Date, default: null },
    /** Set when transcription completes; used for monthly usage (counts even if media is later deleted). */
    completedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

mediaSchema.index({ mediaUploadedBy: 1, createdAt: -1 });

const Media = mongoose.model('Media', mediaSchema);
module.exports = Media;