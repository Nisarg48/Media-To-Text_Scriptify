const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const {
    getStats,
    getAllMedia,
    getAdminMediaById,
    getAllUsers,
    getJobs,
    restoreMedia,
    retryFailedJob,
} = require('../controllers/adminController');

// All admin routes require valid JWT + admin role
router.use(auth, adminAuth);

// GET /api/admin/stats
router.get('/stats', getStats);

// GET /api/admin/media
router.get('/media', getAllMedia);

// GET /api/admin/media/:id
router.get('/media/:id', getAdminMediaById);

// GET /api/admin/users
router.get('/users', getAllUsers);

// GET /api/admin/jobs
router.get('/jobs', getJobs);

// POST /api/admin/media/:id/restore
router.post('/media/:id/restore', restoreMedia);

// POST /api/admin/media/:id/retry-job
router.post('/media/:id/retry-job', retryFailedJob);

module.exports = router;
