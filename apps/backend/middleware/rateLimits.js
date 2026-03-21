const rateLimit = require('express-rate-limit');

/** Stricter limit for login/register */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many attempts, try again later' },
});

/** Presigned URL + finalize */
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many upload requests, try again later' },
});

/** General API (mounted at /api; skips /health) */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
});

module.exports = { authLimiter, uploadLimiter, apiLimiter };
