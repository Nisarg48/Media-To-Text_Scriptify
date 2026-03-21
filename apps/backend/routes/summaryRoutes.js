const express = require('express');
const routes = express.Router();
const { auth } = require('../middleware/auth');
const {
    getSummary,
    generateSummary,
    updateSummaryNotes,
    downloadSummaryPdf,
} = require('../controllers/summaryController');

routes.get('/:mediaId/download/pdf', auth, downloadSummaryPdf);
routes.get('/:mediaId', auth, getSummary);
routes.post('/:mediaId/generate', auth, generateSummary);
routes.put('/:mediaId', auth, updateSummaryNotes);

module.exports = routes;
