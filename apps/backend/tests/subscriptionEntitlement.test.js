const {
    getEffectiveSubscriptionState,
    reconcileStaleStripeSubscription,
    resolveSubscription,
} = require('../controllers/subscriptionController');

jest.mock('../models/Subscription', () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/Media', () => ({
    countDocuments: jest.fn(),
}));

jest.mock('../services/subscriptionAuditService', () => ({
    logSubscriptionEvent: jest.fn(),
}));

const Subscription = require('../models/Subscription');
const Media = require('../models/Media');

describe('getEffectiveSubscriptionState', () => {
    const march25 = new Date('2025-03-25T12:00:00.000Z');
    const march26 = new Date('2025-03-26T23:59:59.000Z');
    const march28 = new Date('2025-03-28T12:00:00.000Z');

    it('returns pro when active, plan pro, and now before period end', () => {
        const r = getEffectiveSubscriptionState(
            { plan: 'pro', status: 'active', currentPeriodEnd: march26 },
            march25
        );
        expect(r).toEqual({ effectivePlan: 'pro', reason: 'active_period' });
    });

    it('returns free when active pro but period ended', () => {
        const r = getEffectiveSubscriptionState(
            { plan: 'pro', status: 'active', currentPeriodEnd: march26 },
            march28
        );
        expect(r.effectivePlan).toBe('free');
        expect(r.reason).toBe('period_expired_or_missing');
    });

    it('returns free when pro but currentPeriodEnd missing', () => {
        const r = getEffectiveSubscriptionState(
            { plan: 'pro', status: 'active', currentPeriodEnd: null },
            march25
        );
        expect(r.effectivePlan).toBe('free');
        expect(r.reason).toBe('period_expired_or_missing');
    });

    it('returns free for past_due and canceled regardless of period', () => {
        expect(
            getEffectiveSubscriptionState(
                { plan: 'pro', status: 'past_due', currentPeriodEnd: march26 },
                march25
            ).effectivePlan
        ).toBe('free');
        expect(
            getEffectiveSubscriptionState(
                { plan: 'pro', status: 'canceled', currentPeriodEnd: march26 },
                march25
            ).effectivePlan
        ).toBe('free');
    });

    it('returns free for incomplete', () => {
        expect(
            getEffectiveSubscriptionState({
                plan: 'pro',
                status: 'incomplete',
                currentPeriodEnd: march26,
            }, march25).effectivePlan
        ).toBe('free');
    });

    it('returns free for plan free', () => {
        expect(
            getEffectiveSubscriptionState(
                { plan: 'free', status: 'active', currentPeriodEnd: march26 },
                march25
            )
        ).toEqual({ effectivePlan: 'free', reason: 'plan_free' });
    });

    it('returns pro for trialing inside period', () => {
        expect(
            getEffectiveSubscriptionState(
                { plan: 'pro', status: 'trialing', currentPeriodEnd: march26 },
                march25
            ).effectivePlan
        ).toBe('pro');
    });
});

describe('reconcileStaleStripeSubscription', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.STRIPE_SECRET_KEY;
    });

    it('returns sub unchanged when STRIPE_SECRET_KEY unset (no Stripe client)', async () => {
        const sub = { _id: 'x', plan: 'pro', status: 'active', currentPeriodEnd: new Date('2020-01-01') };
        const out = await reconcileStaleStripeSubscription(sub);
        expect(out).toBe(sub);
        expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('returns sub unchanged when period not expired even if stripe id present', async () => {
        const sub = {
            _id: 'x',
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: new Date('2099-01-01'),
            stripeSubscriptionId: 'sub_1',
        };
        const out = await reconcileStaleStripeSubscription(sub);
        expect(out).toBe(sub);
        expect(Subscription.findOneAndUpdate).not.toHaveBeenCalled();
    });
});

describe('resolveSubscription', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.STRIPE_SECRET_KEY;
        Media.countDocuments.mockResolvedValue(2);
    });

    it('returns free limits when pro in DB but period ended', async () => {
        Subscription.findOne.mockResolvedValue({
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: new Date('2020-01-01'),
            currentPeriodStart: new Date('2019-12-01'),
            cancelAtPeriodEnd: false,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
        });

        const data = await resolveSubscription('507f1f77bcf86cd799439011');

        expect(data.plan).toBe('free');
        expect(data.mediaCount).toBe(2);
        expect(data.maxMediaCount).toBe(3);
        expect(data.retentionDays).toBe(15);
        expect(data.minutesLimit).toBeUndefined();
        expect(Media.countDocuments).toHaveBeenCalled();
    });

    it('returns pro when inside billing period', async () => {
        const end = new Date(Date.now() + 86400000 * 30);
        const start = new Date(Date.now() - 86400000);
        Subscription.findOne.mockResolvedValue({
            plan: 'pro',
            status: 'active',
            currentPeriodEnd: end,
            currentPeriodStart: start,
            cancelAtPeriodEnd: false,
            stripeCustomerId: 'cus_x',
            stripeSubscriptionId: null,
        });

        const data = await resolveSubscription('507f1f77bcf86cd799439011');

        expect(data.plan).toBe('pro');
        expect(data.minutesLimit).toBeUndefined();
        expect(data.mediaCount).toBe(2);
        expect(data.maxMediaCount).toBe(10);
        expect(data.retentionDays).toBe(30);
    });
});
