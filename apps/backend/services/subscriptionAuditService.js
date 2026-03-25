const SubscriptionAuditLog = require('../models/SubscriptionAuditLog');

/**
 * Append-only audit trail for subscription lifecycle (analytics, admin, compliance).
 */
async function logSubscriptionEvent({ userId, action, fromPlan, toPlan, stripeEventId = null, metadata = {} }) {
    try {
        const doc = {
            userId,
            action,
            metadata,
        };
        if (fromPlan != null) doc.fromPlan = fromPlan;
        if (toPlan != null) doc.toPlan = toPlan;
        if (stripeEventId) doc.stripeEventId = stripeEventId;
        await SubscriptionAuditLog.create(doc);
    } catch (err) {
        console.error('subscriptionAuditService.logSubscriptionEvent:', err.message);
    }
}

module.exports = { logSubscriptionEvent };
