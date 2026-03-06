const express = require('express');
const routes = express.Router();
const { auth }= require('../middleware/auth');
const { getTranscriptContent, 
        updateTranscript, 
        downloadSrt } = require('../controllers/transcriptController');

// @route  GET /api/transcripts/:mediaId/content
// @desc   Fetch the actual JSON transcript data from MinIO for the React Editor
// @access Private
routes.get('/:mediaId/content', auth, getTranscriptContent);

// @route  PUT /api/transcripts/:mediaId
// @desc   Save human edits (updated text and segments) back to DB and MinIO
// @access Private
routes.put('/:mediaId', auth, updateTranscript);

// @route  GET /api/transcripts/:mediaId/download
// @desc   Read JSON from MinIO, convert to SRT, and trigger file download
// @access Private
routes.get('/:mediaId/download', auth, downloadSrt);

module.exports = routes;