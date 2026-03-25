const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
    getMySubscription,
    createCheckoutSession,
    createPortalSession,
    handleWebhook,
} = require('../controllers/subscriptionController');

// Webhook must use raw body — mounted before JSON middleware in app.js
router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    handleWebhook
);

router.get('/me', auth, getMySubscription);
router.post('/checkout', auth, createCheckoutSession);
router.post('/portal', auth, createPortalSession);

module.exports = router;
