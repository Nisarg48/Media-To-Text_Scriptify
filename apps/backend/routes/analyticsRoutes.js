const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getMyStats } = require('../controllers/analyticsController');

router.get('/me', auth, getMyStats);

module.exports = router;
