const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Summary = require('../models/Summary');
const Transcript = require('../models/Transcript');
const { assertUserOwnsMedia } = require('../middleware/mediaAccess');
const { buildSummaryPdfBuffer, summaryAttachmentFilename } = require('../utils/summaryPdf');

const DEFAULT_SUMMARY_MODEL = process.env.GEMINI_SUMMARY_MODEL;
/**
 * Maps @google/generative-ai errors to a short user message and HTTP status.
 */
function mapGeminiError(err) {
    const m = String(err?.message || err || '');
    if (!m) {
        return { msg: 'Failed to generate summary', status: 500 };
    }
    if (m.includes('GEMINI_API_KEY is not configured')) {
        return { msg: 'Summaries are not configured (missing GEMINI_API_KEY)', status: 500 };
    }
    if (/429|Too Many Requests|quota|Quota exceeded|RESOURCE_EXHAUSTED|free_tier/i.test(m)) {
        return {
            msg: 'Gemini quota or rate limit reached. Wait and retry, set GEMINI_SUMMARY_MODEL (e.g. gemini-2.5-flash-lite), or enable billing in Google AI Studio.',
            status: 429,
        };
    }
    if (/404|not found|not supported for generateContent/i.test(m) && /model/i.test(m)) {
        return {
            msg: 'Unknown or retired model. Set GEMINI_SUMMARY_MODEL to a current id (e.g. gemini-2.5-flash). See https://ai.google.dev/gemini-api/docs/models',
            status: 400,
        };
    }
    if (/400|not found/i.test(m) && /model/i.test(m)) {
        return {
            msg: 'Invalid GEMINI_SUMMARY_MODEL. Use a model id from https://ai.google.dev/gemini-api/docs/models',
            status: 400,
        };
    }
    return { msg: 'Failed to generate summary', status: 500 };
}

async function generateSummaryText(plainText, languageHint) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    const modelName = process.env.GEMINI_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL;
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a helpful assistant. Summarize the following transcript in **Markdown** (GitHub-flavored).
${languageHint && languageHint !== 'original' ? `Write in language code: ${languageHint} (natural language for that locale).` : 'Use the same language as the transcript when possible.'}

Formatting rules:
- Use ## for a short title if helpful, then normal paragraphs.
- Use bullet lists (- item) for key points, steps, or takeaways when appropriate.
- Use **bold** for important terms or names.
- Do not wrap the whole answer in a code fence.
- Do not start with "Here is the summary" or similar filler.

Transcript:
---
${plainText.slice(0, 80000)}
---`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text || !String(text).trim()) {
        throw new Error('Empty summary from model');
    }
    return String(text).trim();
}

// GET /api/summaries/:mediaId
const getSummary = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const summary = await Summary.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        return res.json({ summary: summary || null });
    } catch (err) {
        console.error('getSummary:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// POST /api/summaries/:mediaId/generate
const generateSummary = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        if (media.status !== 'COMPLETED') {
            return res.status(400).json({ msg: 'Media must be transcribed before summarizing' });
        }

        const transcript = await Transcript.findOne({ mediaId: media._id });
        if (!transcript || !transcript.plainText?.trim()) {
            return res.status(404).json({ msg: 'Transcript not found or empty' });
        }

        const language =
            (req.body && req.body.language) ||
            transcript.language ||
            media.targetLanguageCode ||
            media.detectedLanguage ||
            'en';

        const summaryText = await generateSummaryText(transcript.plainText, language);

        let summary = await Summary.findOne({ mediaId: media._id });
        if (summary) {
            summary.text = summaryText;
            summary.language = typeof language === 'string' ? language : 'en';
            summary.transcriptId = transcript._id;
            await summary.save();
        } else {
            summary = await Summary.create({
                mediaId: media._id,
                transcriptId: transcript._id,
                text: summaryText,
                language: typeof language === 'string' ? language : 'en',
            });
        }

        return res.status(201).json({ msg: 'Summary generated', summary });
    } catch (err) {
        console.error('generateSummary:', err.message || err);
        const { msg, status } = mapGeminiError(err);
        return res.status(status).json({ msg });
    }
};

// PUT /api/summaries/:mediaId  — user notes
const updateSummaryNotes = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const { userText } = req.body;
        if (userText === undefined) {
            return res.status(400).json({ msg: 'userText is required' });
        }

        const summary = await Summary.findOne({ mediaId: media._id });
        if (!summary) {
            return res.status(404).json({ msg: 'No summary to update' });
        }

        summary.userText = userText === null || userText === '' ? undefined : String(userText);
        await summary.save();

        return res.json({ msg: 'Notes saved', summary });
    } catch (err) {
        console.error('updateSummaryNotes:', err);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// GET /api/summaries/:mediaId/download/pdf
const downloadSummaryPdf = async (req, res) => {
    try {
        const media = await assertUserOwnsMedia(req, res, req.params.mediaId);
        if (!media) return;

        const summary = await Summary.findOne({ mediaId: new mongoose.Types.ObjectId(req.params.mediaId) });
        if (!summary?.text?.trim()) {
            return res.status(404).json({ msg: 'No summary to export' });
        }

        const buf = await buildSummaryPdfBuffer({
            mediaTitle: media.filename || 'Untitled',
            summaryMarkdown: summary.text,
        });
        const filename = summaryAttachmentFilename(media.filename);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(buf);
    } catch (err) {
        console.error('downloadSummaryPdf:', err);
        return res.status(500).json({ msg: 'Failed to build PDF' });
    }
};

module.exports = {
    getSummary,
    generateSummary,
    updateSummaryNotes,
    downloadSummaryPdf,
};
