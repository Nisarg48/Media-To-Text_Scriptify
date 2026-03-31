/**
 * Plan definitions — single source of truth for limits and Stripe price IDs.
 * Add STRIPE_PRICE_ID_PRO to .env to enable Stripe checkout.
 *
 * Each plan: maxMediaCount, maxFileSizeMB, retentionDays, maxParallelJobs.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    maxMediaCount: 3,
    maxFileSizeMB: 200,
    retentionDays: 15,
    maxParallelJobs: 2,
    features: [
      '3 media files at a time',
      '200 MB max per file',
      '15-day retention',
      '2 parallel jobs',
      'SRT, WebVTT, TXT export',
      'AI summaries',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO,
    maxMediaCount: 10,
    maxFileSizeMB: 800,
    retentionDays: 30,
    maxParallelJobs: 10,
    features: [
      '10 media files at a time',
      '800 MB max per file',
      '30-day retention',
      '10 parallel jobs',
      'SRT, WebVTT, TXT export',
      'AI summaries',
      'Priority processing',
    ],
  },
};

/** Return limits for a plan id, defaulting to free. */
function getPlanLimits(planId) {
  return PLANS[planId] ?? PLANS.free;
}

module.exports = { PLANS, getPlanLimits };
