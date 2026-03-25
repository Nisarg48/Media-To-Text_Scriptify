const mongoose = require('mongoose');

const subscriptionAuditLogSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        action: {
            type: String,
            required: true,
            enum: [
                'signup_free',
                'signup_chose_pro',
                'checkout_started',
                'upgraded_to_pro',
                'downgraded_to_free',
                'subscription_updated',
                'payment_failed',
                'invoice_paid',
            ],
            index: true,
        },
        fromPlan: { type: String, enum: ['free', 'pro'], default: undefined },
        toPlan: { type: String, enum: ['free', 'pro'], default: undefined },
        stripeEventId: { type: String, sparse: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

subscriptionAuditLogSchema.index({ userId: 1, createdAt: -1 });
subscriptionAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SubscriptionAuditLog', subscriptionAuditLogSchema);
