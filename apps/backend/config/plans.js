/**
 * Plan definitions — single source of truth for limits and Stripe price IDs.
 * Add STRIPE_PRICE_ID_PRO to .env to enable Stripe checkout.
 */
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    minutesPerMonth: 30,
    /** Max length of a single media file (minutes). Enforced using client-reported duration + worker length. */
    maxDurationMinutesPerFile: 30,
    maxFileSizeMB: 500,
    maxParallelJobs: 2,
    features: [
      '30 minutes of transcription per month (usage does not reset when you delete files)',
      'Up to 30 minutes length per file',
      'Up to 500 MB per file',
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
    minutesPerMonth: 300,
    maxDurationMinutesPerFile: 480,
    maxFileSizeMB: 2048,
    maxParallelJobs: 10,
    features: [
      '300 minutes of transcription per month (usage does not reset when you delete files)',
      'Up to 8 hours length per file',
      'Up to 2 GB per file',
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
