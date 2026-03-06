const Transcript = require('../models/Transcript');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/storage');
const mongoose = require('mongoose');

// --- HELPER: Convert MinIO Stream to String ---
const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

// --- HELPER: Format seconds (e.g., 3.32) to SRT timestamp (00:00:03,320) ---
const formatSrtTime = (seconds) => {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
};

// @route  GET /api/transcripts/:mediaId/content
// @desc   Fetch the actual JSON transcript data from MinIO for the React Editor
// @access Private
const getTranscriptContent = async (req, res) => {
    try {
        const transcript = await Transcript.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        if (!transcript || !transcript.jsonFile) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        const getCommand = new GetObjectCommand({
            Bucket: transcript.jsonFile.bucket,
            Key: transcript.jsonFile.key,
        });

        const response = await s3Client.send(getCommand);
        const jsonString = await streamToString(response.Body);
        const jsonData = JSON.parse(jsonString);

        res.json(jsonData);
    } catch (error) {
        console.error("Error fetching transcript content:", error);
        res.status(500).send('Server error');
    }
};

// @route  PUT /api/transcripts/:mediaId
// @desc   Save human edits (updated text and segments) back to DB and MinIO
// @access Private
const updateTranscript = async (req, res) => {
    try {
        const { updatedText, updatedSegments } = req.body;

        const transcript = await Transcript.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        if (!transcript) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        // 1. Update the plain text in MongoDB
        transcript.plainText = updatedText;
        await transcript.save();

        // 2. Overwrite the JSON file in MinIO
        const newJsonData = JSON.stringify({
            text: updatedText,
            segments: updatedSegments
        }, null, 2);

        const updateCommand = new PutObjectCommand({
            Bucket: transcript.jsonFile.bucket,
            Key: transcript.jsonFile.key,
            Body: newJsonData,
            ContentType: 'application/json'
        });

        await s3Client.send(updateCommand);

        res.json({ msg: 'Transcript updated successfully' });
    } catch (error) {
        console.error("Error updating transcript:", error);
        res.status(500).send('Server error');
    }
};

// @route  GET /api/transcripts/:mediaId/download
// @desc   Read JSON from MinIO, convert to SRT, and trigger file download
// @access Private
const downloadSrt = async (req, res) => {
    try {
        const transcript = await Transcript.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        if (!transcript || !transcript.jsonFile) {
            return res.status(404).json({ msg: 'Transcript not found' });
        }

        // Fetch the JSON from MinIO
        const getCommand = new GetObjectCommand({
            Bucket: transcript.jsonFile.bucket,
            Key: transcript.jsonFile.key,
        });

        const response = await s3Client.send(getCommand);
        const jsonString = await streamToString(response.Body);
        const jsonData = JSON.parse(jsonString);
        const segments = jsonData.segments;

        // Build the SRT string
        let srtContent = '';
        segments.forEach((segment, index) => {
            srtContent += `${index + 1}\n`;
            srtContent += `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n`;
            srtContent += `${segment.text.trim()}\n\n`;
        });

        // Send as a downloadable file
        res.setHeader('Content-Type', 'text/srt; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="transcript_${req.params.mediaId}.srt"`);
        res.send(srtContent);
    } catch (error) {
        console.error("Error generating SRT:", error);
        res.status(500).send('Server error');
    }
};

module.exports = {
    getTranscriptContent,
    updateTranscript,
    downloadSrt
};