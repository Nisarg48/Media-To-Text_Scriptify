import { Link } from 'react-router-dom';
import { PRICING_PLANS } from '../data/pricingPlans';

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/**
 * Reusable pricing grid for Landing and /pricing.
 * @param {{ compact?: boolean, className?: string }} props
 */
export default function PricingSection({ compact = false, className = '' }) {
  return (
    <section className={`w-full ${className}`}>
      {!compact && (
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-lg text-slate-500">
            Start free. Upgrade when you need more. Monthly minutes are tracked when transcription completes.
          </p>
        </div>
      )}

      <div
        className={`mx-auto mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2 ${compact ? 'mt-0' : ''}`}
      >
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-8 shadow-sm transition-shadow hover:shadow-md ${
              plan.highlight
                ? 'border-emerald-400 bg-white ring-2 ring-emerald-400/20'
                : 'border-slate-200 bg-white'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                Most popular
              </span>
            )}

            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">{plan.name}</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                <span className="mb-1 text-sm text-slate-400">/{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5">
                    <CheckIcon />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to={plan.ctaTo}
              className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                plan.highlight
                  ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600 hover:shadow-lg'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="mt-8 text-center text-sm text-slate-400">
          No credit card required for Free. Pro is billed securely via Stripe.
        </p>
      )}
    </section>
  );
}
