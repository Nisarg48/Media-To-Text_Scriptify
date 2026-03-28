const Transcript = require('../models/Transcript');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const mongoose = require('mongoose');
const { assertUserOwnsMedia } = require('../middleware/mediaAccess');
const {
    segmentsToSrt,
    segmentsToVtt,
    segmentsToTxt,
} = require('../utils/subtitleFormats');

const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

async function loadTranscriptJsonForMedia(mediaId) {
    const transcript = await Transcript.findOne({ mediaId: new mongoose.Types.ObjectId(mediaId) });
    if (!transcript || !transcript.jsonFile) {
        return { transcript: null, jsonData: null };
    }

    const getCommand = new GetObjectCommand({
        Bucket: transcript.jsonFile.bucket,
        Key: transcript.jsonFile.key,
    });

    const response = await s3Client.send(getCommand);
    const jsonString = await streamToString(response.Body);
    const jsonData = JSON.parse(jsonString);
    return { transcript, jsonData };
}

// @route  GET /api/transcripts/:mediaId/content
// @access Private (must own media)
const getTranscriptContent = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const { transcript, jsonData } = await loadTranscriptJsonForMedia(req.params.mediaId);
        if (!transcript || !jsonData) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        res.set('Cache-Control', 'private, max-age=60');
        res.json(jsonData);
    } catch (error) {
        console.error('Error fetching transcript content:', error);
        res.status(500).send('Server error');
    }
};

// @route  PUT /api/transcripts/:mediaId
// @access Private (must own media)
const updateTranscript = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const { updatedText, updatedSegments } = req.body;

        const transcript = await Transcript.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        if (!transcript) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        transcript.plainText = updatedText;
        await transcript.save();

        const newJsonData = JSON.stringify({
            text: updatedText,
            segments: updatedSegments,
        });

        const updateCommand = new PutObjectCommand({
            Bucket: transcript.jsonFile.bucket,
            Key: transcript.jsonFile.key,
            Body: newJsonData,
            ContentType: 'application/json',
        });

        await s3Client.send(updateCommand);

        res.json({ msg: 'Transcript updated successfully' });
    } catch (error) {
        console.error('Error updating transcript:', error);
        res.status(500).send('Server error');
    }
};

/**
 * GET /api/transcripts/:mediaId/download?format=srt|vtt|txt
 * Default format=srt for backward compatibility.
 */
const downloadExport = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const format = String(req.query.format || 'srt').toLowerCase();
        const allowed = ['srt', 'vtt', 'txt'];
        if (!allowed.includes(format)) {
            return res.status(400).json({ msg: `Invalid format. Use one of: ${allowed.join(', ')}` });
        }

        const { transcript, jsonData } = await loadTranscriptJsonForMedia(req.params.mediaId);
        if (!transcript || !jsonData) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        const segments = jsonData.segments || [];
        const base = `transcript_${req.params.mediaId}`;

        if (format === 'srt') {
            const srtContent = segmentsToSrt(segments);
            res.setHeader('Content-Type', 'text/srt; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${base}.srt"`);
            return res.send(srtContent);
        }

        if (format === 'vtt') {
            const vtt = segmentsToVtt(segments);
            res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${base}.vtt"`);
            return res.send(vtt);
        }

        const txt = segmentsToTxt(segments);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${base}.txt"`);
        return res.send(txt);
    } catch (error) {
        console.error('Error generating download:', error);
        res.status(500).send('Server error');
    }
};

module.exports = {
    getTranscriptContent,
    updateTranscript,
    downloadExport,
};
