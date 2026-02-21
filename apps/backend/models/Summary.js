const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema(
  {
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    transcriptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transcript', required: true },
    text: { type: String, required: true },
    language: { type: String, required: true },
    userText: { type: String },
  },
  { timestamps: true }
);

summarySchema.index({ mediaId: 1 });
summarySchema.index({ transcriptId: 1 });

const Summary = mongoose.model('Summary', summarySchema);
module.exports = Summary;