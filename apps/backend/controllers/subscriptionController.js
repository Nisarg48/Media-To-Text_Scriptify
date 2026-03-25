const Stripe = require('stripe');
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Media = require('../models/Media');
const { PLANS, getPlanLimits } = require('../config/plans');
const { logSubscriptionEvent } = require('../services/subscriptionAuditService');

/** Build a Stripe client only when the secret key is configured. */
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

/**
 * Minutes consumed in the billing period — sticky monthly pool: counts jobs that **finished**
 * in [start, end), even if the user later deletes the media (deleting does not refund minutes).
 */
async function getMinutesUsedInPeriod(userId, periodStart, periodEnd) {
    const start = periodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = periodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

    const uid = mongoose.Types.ObjectId.createFromHexString(userId.toString());

    const result = await Media.aggregate([
        {
            $match: {
                mediaUploadedBy: uid,
                status: 'COMPLETED',
                lengthMs: { $gt: 0 },
                $or: [
                    { completedAt: { $gte: start, $lt: end } },
                    {
                        $or: [{ completedAt: null }, { completedAt: { $exists: false } }],
                        updatedAt: { $gte: start, $lt: end },
                    },
                ],
            },
        },
        { $group: { _id: null, totalMs: { $sum: '$lengthMs' } } },
    ]);

    return Math.round((result[0]?.totalMs ?? 0) / 60000);
}

/**
 * Get or synthesise a free subscription record for a user.
 * Returns { plan, status, minutesUsed, minutesLimit, maxFileSizeMB, maxParallelJobs,
 *           currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, stripeCustomerId }
 */
async function resolveSubscription(userId) {
    let sub = await Subscription.findOne({ userId });

    if (!sub) {
        // No record → default free plan (calendar month period)
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const limits = getPlanLimits('free');
        const minutesUsed = await getMinutesUsedInPeriod(userId, periodStart, periodEnd);
        return {
            plan: 'free',
            status: 'active',
            minutesUsed,
            minutesLimit: limits.minutesPerMonth,
            maxFileSizeMB: limits.maxFileSizeMB,
            maxDurationMinutesPerFile: limits.maxDurationMinutesPerFile,
            maxParallelJobs: limits.maxParallelJobs,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
            stripeCustomerId: null,
        };
    }

    const effectivePlan = (sub.status === 'canceled' || sub.status === 'past_due') ? 'free' : sub.plan;
    const limits = getPlanLimits(effectivePlan);
    const periodStart = sub.currentPeriodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = sub.currentPeriodEnd ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    const minutesUsed = await getMinutesUsedInPeriod(userId, periodStart, periodEnd);

    return {
        plan: effectivePlan,
        status: sub.status,
        minutesUsed,
        minutesLimit: limits.minutesPerMonth,
        maxFileSizeMB: limits.maxFileSizeMB,
        maxDurationMinutesPerFile: limits.maxDurationMinutesPerFile,
        maxParallelJobs: limits.maxParallelJobs,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        stripeCustomerId: sub.stripeCustomerId ?? null,
    };
}

// @route  GET /api/subscriptions/me
// @access Private
const getMySubscription = async (req, res) => {
    try {
        const data = await resolveSubscription(req.user.id);
        return res.json(data);
    } catch (err) {
        console.error('subscriptionController.getMySubscription:', err.message);
        return res.status(500).json({ msg: 'Server error' });
    }
};

// @route  POST /api/subscriptions/checkout
// @desc   Create a Stripe Checkout session for upgrading to Pro
// @access Private
const createCheckoutSession = async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ msg: 'Billing is not configured on this server.' });
    }

    const priceId = process.env.STRIPE_PRICE_ID_PRO;
    if (!priceId) {
        return res.status(503).json({ msg: 'Pro plan price is not configured.' });
    }

    try {
        const sub = await Subscription.findOne({ userId: req.user.id });
        let customerId = sub?.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                metadata: { userId: req.user.id },
            });
            customerId = customer.id;
        }

        const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/pricing`,
            metadata: { userId: req.user.id },
        });

        await logSubscriptionEvent({
            userId: req.user.id,
            action: 'checkout_started',
            fromPlan: (await Subscription.findOne({ userId: req.user.id }))?.plan || 'free',
            toPlan: 'pro',
            metadata: { checkoutSessionId: session.id },
        });

        return res.json({ url: session.url });
    } catch (err) {
        console.error('subscriptionController.createCheckoutSession:', err.message);
        return res.status(500).json({ msg: 'Failed to create checkout session.' });
    }
};

// @route  POST /api/subscriptions/portal
// @desc   Create a Stripe Billing Portal session (manage/cancel)
// @access Private
const createPortalSession = async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ msg: 'Billing is not configured on this server.' });
    }

    try {
        const sub = await Subscription.findOne({ userId: req.user.id });
        if (!sub?.stripeCustomerId) {
            return res.status(400).json({ msg: 'No billing account found. Please upgrade first.' });
        }

        const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';

        const session = await stripe.billingPortal.sessions.create({
            customer: sub.stripeCustomerId,
            return_url: `${origin}/dashboard/billing`,
        });

        return res.json({ url: session.url });
    } catch (err) {
        console.error('subscriptionController.createPortalSession:', err.message);
        return res.status(500).json({ msg: 'Failed to create portal session.' });
    }
};

// @route  POST /api/subscriptions/webhook
// @desc   Handle Stripe webhook events (raw body required — see app.js)
// @access Public (verified by Stripe signature)
const handleWebhook = async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.sendStatus(200);

    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.sendStatus(200);

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
        console.error('Stripe webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode !== 'subscription') break;
                const userId = session.metadata?.userId;
                if (!userId) break;

                const prev = await Subscription.findOne({ userId });
                const fromPlan = prev?.plan === 'pro' ? 'pro' : 'free';

                const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
                await Subscription.findOneAndUpdate(
                    { userId },
                    {
                        userId,
                        plan: 'pro',
                        status: stripeSub.status,
                        stripeCustomerId: session.customer,
                        stripeSubscriptionId: session.subscription,
                        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
                        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
                    },
                    { upsert: true, new: true }
                );

                await logSubscriptionEvent({
                    userId,
                    action: 'upgraded_to_pro',
                    fromPlan,
                    toPlan: 'pro',
                    stripeEventId: event.id,
                    metadata: { stripeSubscriptionId: session.subscription },
                });
                break;
            }

            case 'invoice.paid': {
                const invoice = event.data.object;
                if (!invoice.subscription) break;
                const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription);
                const customerId = invoice.customer;
                const sub = await Subscription.findOne({ stripeCustomerId: customerId });
                if (!sub) break;

                const prevPlan = sub.plan;
                sub.status = stripeSub.status;
                sub.plan = 'pro';
                sub.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
                sub.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
                sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
                await sub.save();

                await logSubscriptionEvent({
                    userId: sub.userId,
                    action: 'invoice_paid',
                    fromPlan: prevPlan === 'pro' ? 'pro' : 'free',
                    toPlan: 'pro',
                    stripeEventId: event.id,
                    metadata: { invoiceId: invoice.id },
                });
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const sub = await Subscription.findOne({ stripeCustomerId: invoice.customer });
                if (sub) {
                    sub.status = 'past_due';
                    await sub.save();
                    await logSubscriptionEvent({
                        userId: sub.userId,
                        action: 'payment_failed',
                        fromPlan: sub.plan === 'pro' ? 'pro' : 'free',
                        toPlan: sub.plan === 'pro' ? 'pro' : 'free',
                        stripeEventId: event.id,
                        metadata: { invoiceId: invoice.id },
                    });
                }
                break;
            }

            case 'customer.subscription.updated': {
                const stripeSub = event.data.object;
                const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
                if (!sub) break;
                const prevPlan = sub.plan;
                sub.status = stripeSub.status;
                sub.plan = stripeSub.status === 'active' || stripeSub.status === 'trialing' ? 'pro' : 'free';
                sub.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
                sub.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
                sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
                await sub.save();

                await logSubscriptionEvent({
                    userId: sub.userId,
                    action: 'subscription_updated',
                    fromPlan: prevPlan === 'pro' ? 'pro' : 'free',
                    toPlan: sub.plan === 'pro' ? 'pro' : 'free',
                    stripeEventId: event.id,
                    metadata: { stripeStatus: stripeSub.status },
                });
                break;
            }

            case 'customer.subscription.deleted': {
                const stripeSub = event.data.object;
                const sub = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
                if (!sub) break;
                const prevPlan = sub.plan;
                sub.status = 'canceled';
                sub.plan = 'free';
                sub.cancelAtPeriodEnd = false;
                await sub.save();

                await logSubscriptionEvent({
                    userId: sub.userId,
                    action: 'downgraded_to_free',
                    fromPlan: prevPlan === 'pro' ? 'pro' : 'free',
                    toPlan: 'free',
                    stripeEventId: event.id,
                    metadata: { reason: 'subscription_deleted' },
                });
                break;
            }

            default:
                break;
        }

        return res.sendStatus(200);
    } catch (err) {
        console.error('subscriptionController.handleWebhook event error:', err.message);
        return res.sendStatus(500);
    }
};

module.exports = {
    getMySubscription,
    createCheckoutSession,
    createPortalSession,
    handleWebhook,
    resolveSubscription,
};
