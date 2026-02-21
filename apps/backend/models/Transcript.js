const mongoose = require('mongoose');
const StorageSchema = require('./Storage').schema;

const transcriptSchema = new mongoose.Schema(
  {
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    
    plainText: { type: String, required: true },
    jsonFile: { type: StorageSchema, required: true },

    language: { type: String, required: true },
    languageDetectionConfidence: { type: Number, min: 0, max: 1 },

    modelSize: { type: String },
    totalTranscriptionTime: { type: Number, min: 0 },
    modelProcessingTime: { type: Number, min: 0 },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { timestamps: true }
);
transcriptSchema.index({ mediaId: 1 });
transcriptSchema.index({ mediaId: 1 });

const Transcript = mongoose.model('Transcript', transcriptSchema);
module.exports = Transcript;