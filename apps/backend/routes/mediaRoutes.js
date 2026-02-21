const express = require('express');
const routes = express.Router();
const { auth } = require('../middleware/auth');
const { getUploadUrl, finalizeUpload } = require('../controllers/mediaController');

// @route POST /api/media/presigned-url
// @desc Get a presigned URL for uploading media
// @access Private
routes.post('/presigned-url', auth, getUploadUrl);

// @route POST /api/media/finalize
// @desc Save media record to DB after successful S3 upload
// @access Private
routes.post('/finalize', auth, finalizeUpload);

module.exports = routes;