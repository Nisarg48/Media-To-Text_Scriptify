const express = require('express');
const routes = express.Router();
const { auth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimits');
const { getUploadUrl,
        finalizeUpload,
        getUserMedia,
        getMediaById,
        deleteMediaById,
        getPlaybackUrl } = require('../controllers/mediaController');

// @route POST /api/media/presigned-url
// @desc Get a presigned URL for uploading media
// @access Private
routes.post('/presigned-url', auth, uploadLimiter, getUploadUrl);

// @route POST /api/media/finalize
// @desc Save media record to DB after successful S3 upload
// @access Private
routes.post('/finalize', auth, uploadLimiter, finalizeUpload);

// @route GET /api/media
// @desc Get all media uploads for the logged-in user
// @access Private
routes.get('/', auth, getUserMedia);

// @route GET /api/media/:id
// @desc Get single media details AND its associated transcript
// @access Private
routes.get('/:id', auth, getMediaById);

// @route DELETE /api/media/:id
// @desc Delete a media record, its transcript, and files from MinIO
// @access Private
routes.delete('/:id', auth, deleteMediaById);

// @route GET /api/media/:id/play
// @desc Get a temporary presigned URL to stream the video in the React player
// @access Private
routes.get('/:id/play', auth, getPlaybackUrl);

module.exports = routes;