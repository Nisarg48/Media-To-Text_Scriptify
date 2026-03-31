import { Link } from 'react-router-dom';
import { PRICING_PLANS } from '../data/pricingPlans';

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
          <h2 className="text-h1 font-extrabold tracking-tight text-content sm:text-[2.5rem]">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-content-muted">
            Start free. Upgrade when you need more storage, retention, and capacity.
          </p>
        </div>
      )}

      <div
        className={`mx-auto mt-10 grid w-full max-w-3xl gap-6 sm:grid-cols-2 ${compact ? 'mt-0' : ''}`}
      >
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-8 shadow-glass backdrop-blur-xl transition-shadow hover:shadow-glow-sm ${
              plan.highlight
                ? 'border-accent/50 bg-surface ring-2 ring-accent/20'
                : 'border-surface-border bg-surface/90'
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-accent-foreground shadow-glow-sm">
                Most popular
              </span>
            )}

            <div className="mb-6">
              <p className="text-small font-semibold uppercase tracking-widest text-content-subtle">{plan.name}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-extrabold text-content">{plan.price}</span>
                <span className="mb-1 text-small text-content-subtle">/{plan.period}</span>
              </div>
              <p className="mt-2 text-small text-content-muted">{plan.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-small text-content-muted">
                  <span className="mt-1">
                    <CheckIcon />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to={plan.ctaTo}
              className={`block w-full rounded-xl py-4 text-center text-small font-semibold transition hover:scale-[1.02] active:scale-[0.98] ${
                plan.highlight
                  ? 'bg-accent text-accent-foreground shadow-glow-sm hover:brightness-110'
                  : 'border border-surface-border bg-surface-muted/60 text-content hover:border-accent/40 hover:bg-accent-muted'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {!compact && (
        <p className="mt-10 text-center text-small text-content-subtle">
          No credit card required for Free. Pro is billed securely via Stripe.
        </p>
      )}
    </section>
  );
}
